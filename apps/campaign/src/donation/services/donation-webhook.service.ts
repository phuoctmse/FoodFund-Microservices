import { Injectable, Logger } from "@nestjs/common"
import { DonorRepository } from "../repositories/donor.repository"
import { UserClientService } from "../../shared/services/user-client.service"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { PaymentStatus } from "../../shared/enum/campaign.enum"

interface PayOSWebhookData {
    orderCode: number
    amount: number
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

        // Idempotency check: Already processed by webhook?
        if (paymentTransaction.processed_by_webhook) {
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
     * 1. Update payment_transaction (SUCCESS, gateway=PAYOS, processed_by_webhook=true)
     * 2. Credit Fundraiser Wallet via gRPC
     */
    private async processSuccessfulPayment(
        paymentTransaction: any,
        webhookData: PayOSWebhookData,
    ): Promise<void> {
        const { orderCode } = webhookData

        try {
            // Step 1: Update payment transaction with PayOS data
            await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                gateway: "PAYOS",
                processed_by_webhook: true,
                is_matched: true,
                reference: webhookData.reference,
                transaction_datetime: new Date(webhookData.transactionDateTime),
                counter_account_bank_id: webhookData.counterAccountBankId,
                counter_account_bank_name: webhookData.counterAccountBankName,
                counter_account_name: webhookData.counterAccountName,
                counter_account_number: webhookData.counterAccountNumber,
                virtual_account_name: webhookData.virtualAccountName,
                virtual_account_number: webhookData.virtualAccountNumber,
            })

            this.logger.log(
                `[PayOS] ✅ Payment transaction updated - Order ${orderCode}`,
            )

            // Step 2: Get donation and campaign info
            const donation = paymentTransaction.donation
            if (!donation) {
                this.logger.error(
                    `[PayOS] Donation not found for payment ${paymentTransaction.id}`,
                )
                return
            }

            const campaignId = donation.campaign_id
            const fundraiserId = donation.campaign?.created_by

            if (!fundraiserId) {
                this.logger.error(
                    `[PayOS] Fundraiser not found for campaign ${campaignId}`,
                )
                return
            }

            // Step 3: Credit Fundraiser Wallet via gRPC
            await this.userClientService.creditFundraiserWallet({
                fundraiser_id: fundraiserId,
                campaign_id: campaignId,
                payment_transaction_id: paymentTransaction.id,
                amount: paymentTransaction.amount,
                gateway: "PAYOS",
                description: `Donation from ${donation.donor_name || "Anonymous"} - Order ${orderCode}`,
            })

            this.logger.log(
                `[PayOS] ✅ Fundraiser wallet credited - Order ${orderCode}, Amount: ${paymentTransaction.amount}`,
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
                is_matched: false,
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
}
