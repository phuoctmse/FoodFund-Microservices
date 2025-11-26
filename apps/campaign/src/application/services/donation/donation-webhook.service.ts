import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { DonorRepository } from "../../repositories/donor.repository"
import { UserClientService } from "@app/campaign/src/shared"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { DonationEmailService } from "./donation-email.service"
import { BadgeAwardService } from "./badge-award.service"
import { CampaignFollowerService } from "../campaign/campaign-follower.service"

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

import { DonationSearchService } from "./donation-search.service"

@Injectable()
export class DonationWebhookService {
    private readonly logger = new Logger(DonationWebhookService.name)
    private payOS: PayOS | null = null

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly userClientService: UserClientService,
        private readonly eventEmitter: EventEmitter2,
        private readonly donationEmailService: DonationEmailService,
        private readonly badgeAwardService: BadgeAwardService,
        private readonly campaignFollowerService: CampaignFollowerService,
        private readonly donationSearchService: DonationSearchService,
    ) { }

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
        if (
            paymentTransaction.processed_by_webhook &&
            paymentTransaction.gateway === "PAYOS"
        ) {
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
            const result =
                await this.donorRepository.updatePaymentTransactionSuccess({
                    order_code: BigInt(orderCode),
                    amount_paid: actualAmountReceived,
                    gateway: "PAYOS",
                    processed_by_webhook: true,
                    payos_metadata: {
                        reference: webhookData.reference,
                        transaction_datetime: new Date(
                            webhookData.transactionDateTime,
                        ),
                        counter_account_bank_id:
                            webhookData.counterAccountBankId,
                        counter_account_bank_name:
                            webhookData.counterAccountBankName,
                        counter_account_name: webhookData.counterAccountName,
                        counter_account_number:
                            webhookData.counterAccountNumber,
                        virtual_account_name: webhookData.virtualAccountName,
                        virtual_account_number:
                            webhookData.virtualAccountNumber,
                    },
                })

            // Update OpenSearch index
            if (paymentTransaction.donation) {
                await this.donationSearchService.indexDonation({
                    ...paymentTransaction.donation,
                    amount: paymentTransaction.donation.amount.toString(),
                    status: "SUCCESS", // Or use result.payment.status
                    orderCode: orderCode.toString(),
                    transactionDatetime: new Date(webhookData.transactionDateTime),
                    created_at: paymentTransaction.donation.created_at,
                    updated_at: new Date(),
                    campaignTitle: result.campaign.title,
                    description: webhookData.desc,
                    gateway: "PAYOS",
                    paymentStatus: "COMPLETED",
                    receivedAmount: actualAmountReceived.toString(),
                    bankName: webhookData.counterAccountBankName || "",
                    bankAccount: webhookData.counterAccountNumber || "",
                    currency: "VND",
                    errorCode: "00",
                    errorDescription: "Success",
                    processedByWebhook: true,
                    payosMetadata: webhookData,
                } as any)
            }

            this.logger.log(
                `[PayOS] ✅ Payment transaction updated - Order ${orderCode}, Amount Paid: ${actualAmountReceived}`,
            )

            // Check for campaign surplus and emit event
            const { campaign } = result
            if (
                campaign.received_amount > campaign.target_amount &&
                campaign.status === CampaignStatus.ACTIVE
            ) {
                const surplus =
                    campaign.received_amount - campaign.target_amount
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
            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: campaignId,
                paymentTransactionId: paymentTransaction.id,
                amount: actualAmountReceived,
                gateway: "PAYOS",
                description: `Ủng hộ từ ${donation.donor_name || "Anonymous"} - Đơn hàng ${orderCode}`,
            })

            this.logger.log(
                `[PayOS] ✅ Admin wallet credited - Order ${orderCode}, Amount: ${actualAmountReceived} (Original: ${paymentTransaction.amount})`,
            )

            // Step 5: Send donation confirmation email (if donor is not anonymous)
            await this.donationEmailService.sendDonationConfirmation(
                donation,
                actualAmountReceived,
                result.campaign,
                "PayOS",
            )

            // Step 6: Update donor cached stats and award badge
            if (donation.donor_id) {
                // Get user database ID from cognito_id
                const donor = await this.userClientService.getUserByCognitoId(
                    donation.donor_id,
                )

                if (donor) {
                    // Update cached stats (via gRPC)
                    await this.userClientService.updateDonorStats({
                        donorId: donor.id, // Use database ID, not cognito_id
                        amountToAdd: actualAmountReceived,
                        incrementCount: 1,
                        lastDonationAt: new Date(),
                    })

                    // Award badge (non-blocking, uses cached data)
                    this.awardBadgeAsync(donor.id) // Use database ID, not cognito_id
                } else {
                    this.logger.warn(
                        `[PayOS] Donor not found for cognito_id: ${donation.donor_id}`,
                    )
                }
            }
            await this.campaignFollowerService.invalidateFollowersCache(
                donation.campaign_id,
            )
        } catch (error) {
            this.logger.error(
                `[PayOS] ❌ Failed to process successful payment for order ${orderCode}`,
                error.stack,
            )
            throw error
        }
    }

    private async awardBadgeAsync(donorId: string): Promise<void> {
        try {
            await this.badgeAwardService.checkAndAwardBadge(donorId)
        } catch (error) {
            this.logger.error(
                `[Badge] Failed to award badge to donor ${donorId}:`,
                error.message,
            )
        }
    }

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

            // Update OpenSearch index
            if (paymentTransaction.donation) {
                await this.donationSearchService.indexDonation({
                    ...paymentTransaction.donation,
                    amount: paymentTransaction.donation.amount.toString(),
                    status: "FAILED",
                    orderCode: orderCode.toString(),
                    transactionDatetime: paymentTransaction.created_at,
                    created_at: paymentTransaction.donation.created_at,
                    updated_at: new Date(),
                    campaignTitle: paymentTransaction.donation.campaign?.title || "",
                    description: errorDescription,
                    gateway: "PAYOS",
                    paymentStatus: "FAILED",
                    currency: "VND",
                    errorCode: errorCode || "FAILED",
                    errorDescription: errorDescription,
                    processedByWebhook: true,
                } as any)
            }

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
