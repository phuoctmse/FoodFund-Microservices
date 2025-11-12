import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { DonorRepository } from "../repositories/donor.repository"
import { UserClientService } from "../../shared/services/user-client.service"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { TransactionStatus } from "../../shared/enum/campaign.enum"
import { Campaign, CampaignStatus } from "../../campaign"

interface PayOSWebhookData {
    orderCode: number
    amount: number
    amountPaid?: number
    description: string
    accountNumber: string
    reference: string
    transactionDateTime: string
    currency: string
    paymentLinkId: string
    code: string
    desc: string
    counterAccountBankId?: string
    counterAccountBankName?: string
    counterAccountName?: string
    counterAccountNumber?: string
    virtualAccountName?: string
    virtualAccountNumber?: string
}

@Injectable()
export class DonationWebhookService {
    private readonly logger = new Logger(DonationWebhookService.name)
    private payOS: PayOS | null = null

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly userClientService: UserClientService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private getPayOS(): PayOS {
        if (!this.payOS) {
            const config = envConfig().payos
            if (
                !config.payosClienId ||
                !config.payosApiKey ||
                !config.payosCheckSumKey
            ) {
                throw new Error(
                    "PayOS credentials are not configured. Please set PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY in environment variables.",
                )
            }
            this.payOS = new PayOS({
                clientId: config.payosClienId,
                apiKey: config.payosApiKey,
                checksumKey: config.payosCheckSumKey,
            })
        }
        return this.payOS
    }

    async handlePaymentWebhook(webhookData: PayOSWebhookData): Promise<void> {
        const { orderCode, code, desc, amount } = webhookData

        this.logger.log(`[PayOS] Received webhook for order ${orderCode}`, {
            code,
            desc,
            amount,
        })

        // Find payment transaction by order_code
        const paymentTransaction =
            await this.donorRepository.findPaymentTransactionByOrderCode(
                BigInt(orderCode),
            )

        if (!paymentTransaction) {
            this.logger.warn(
                `[PayOS] Payment transaction not found for order ${orderCode}`,
            )
            return
        }

        // CRITICAL: Check if Sepay already handled this payment (PARTIAL payments < amount)
        // If gateway is "SEPAY", it means Sepay already processed this PARTIAL payment
        // PayOS should NOT process this even if webhook arrives
        if (paymentTransaction.gateway === "SEPAY") {
            this.logger.log(
                `[PayOS] ⚠️ Skipping - Payment already processed by Sepay (PARTIAL payment) - orderCode=${orderCode}`,
            )
            return
        }

        // Idempotency check: Already processed by PayOS webhook?
        // This check comes AFTER gateway check because:
        // - If gateway=SEPAY, PayOS should never process (even if processed_by_webhook=false)
        // - If gateway=PAYOS and processed_by_webhook=true, skip to prevent duplicate
        if (paymentTransaction.processed_by_webhook && paymentTransaction.gateway === "PAYOS") {
            this.logger.log(
                `[PayOS] Webhook already processed for order ${orderCode}`,
            )
            return
        }

        // Update payment status based on webhook code
        if (code === "00") {
            // ✅ Payment successful
            await this.processSuccessfulPayment(paymentTransaction, webhookData)
        } else {
            // ❌ Payment failed
            await this.processFailedPayment(paymentTransaction, code, desc)
        }
    }

    /**
     * Process successful PayOS payment
     * PayOS webhook is ONLY called when user transfers ENOUGH or MORE (>= amount)
     * PARTIAL payments (< amount) are handled by Sepay webhook
     * 
     * 1. Update payment_transaction (SUCCESS, gateway=PAYOS, processed_by_webhook=true)
     * 2. Credit Admin Wallet with ACTUAL amount paid
     */
    private async processSuccessfulPayment(
        paymentTransaction: any,
        webhookData: PayOSWebhookData,
    ): Promise<void> {
        const { orderCode, amount, amountPaid } = webhookData

        try {
            // Use amountPaid (actual received) instead of amount (payment link amount)
            const actualAmountReceived = BigInt(amountPaid || amount)
            const originalAmount = paymentTransaction.amount

            // CRITICAL: PayOS should only handle COMPLETED/OVERPAID (>= amount)
            // PARTIAL payments (< amount) should be handled by Sepay
            if (actualAmountReceived < originalAmount) {
                this.logger.warn(
                    `[PayOS] ⚠️ PARTIAL payment detected (${actualAmountReceived}/${originalAmount}) - This should be handled by Sepay. Skipping PayOS processing.`,
                )
                return
            }

            this.logger.log(
                `[PayOS] Processing ${actualAmountReceived === originalAmount ? "COMPLETED" : "OVERPAID"} payment - ${actualAmountReceived}/${originalAmount}`,
            )

            // Step 1: Update payment transaction with PayOS data and actual amount
            const result = await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                amount_paid: actualAmountReceived,
                gateway: "PAYOS",
                processed_by_webhook: true,
                payos_metadata: {
                    reference: webhookData.reference,
                    transaction_datetime: new Date(webhookData.transactionDateTime),
                    counter_account_bank_id: webhookData.counterAccountBankId,
                    counter_account_bank_name: webhookData.counterAccountBankName,
                    counter_account_name: webhookData.counterAccountName,
                    counter_account_number: webhookData.counterAccountNumber,
                    virtual_account_name: webhookData.virtualAccountName,
                    virtual_account_number: webhookData.virtualAccountNumber,
                },
            })

            this.logger.log(
                `[PayOS] ✅ Payment transaction updated - Order ${orderCode}, Amount Paid: ${actualAmountReceived}`,
            )

            // 🆕 Check for campaign surplus and emit event
            const { campaign } = result
            if (campaign.received_amount > campaign.target_amount && campaign.status === CampaignStatus.ACTIVE) {
                const surplus = campaign.received_amount - campaign.target_amount
                this.logger.log(
                    `[PayOS] 🎯 Surplus detected for campaign ${campaign.id} - Surplus: ${surplus.toString()} VND`,
                )
                this.eventEmitter.emit("campaign.surplus.detected", {
                    campaignId: campaign.id,
                    surplus: surplus.toString(),
                })
            }

            // Step 2: Get donation and campaign info
            const donation = paymentTransaction.donation
            if (!donation) {
                this.logger.error(
                    `[PayOS] Donation not found for payment ${paymentTransaction.id}`,
                )
                return
            }

            const campaignId = donation.campaign_id

            // Step 3: Get system admin ID from environment
            const adminUserId = this.getSystemAdminId()

            // Step 4: Credit Admin Wallet with ACTUAL amount received
            // NOTE: gateway and metadata are stored in Payment_Transaction, NOT Wallet_Transaction
            // Wallet_Transaction links to Payment_Transaction via payment_transaction_id
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: campaignId,
                paymentTransactionId: paymentTransaction.id,
                amount: actualAmountReceived,
                gateway: "PAYOS", // For logging/description only, NOT stored in Wallet_Transaction
                description: `Donation from ${donation.donor_name || "Anonymous"} - Order ${orderCode}`,
            })

            this.logger.log(
                `[PayOS] ✅ Admin wallet credited - Order ${orderCode}, Amount: ${actualAmountReceived} (Original: ${paymentTransaction.amount})`,
            )
        } catch (error) {
            this.logger.error(
                `[PayOS] ❌ Failed to process successful payment for order ${orderCode}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * Process failed PayOS payment
     * Update payment_transaction with error details
     */
    private async processFailedPayment(
        paymentTransaction: any,
        errorCode: string,
        errorDescription: string,
    ): Promise<void> {
        const orderCode = paymentTransaction.order_code

        try {
            await this.donorRepository.updatePaymentTransactionFailed({
                order_code: orderCode,
                gateway: "PAYOS",
                processed_by_webhook: true,
                error_code: errorCode,
                error_description: errorDescription,
            })

            this.logger.warn(`[PayOS] ⚠️ Payment failed - Order ${orderCode}`, {
                errorCode,
                errorDescription,
            })
        } catch (error) {
            this.logger.error(
                `[PayOS] ❌ Failed to update payment failure for order ${orderCode}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * Get system admin user ID from environment
     */
    private getSystemAdminId(): string {
        const adminId = envConfig().systemAdminId || "admin-system-001"
        return adminId
    }
}
