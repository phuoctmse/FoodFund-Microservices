import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { RedisService } from "@libs/redis"
import { envConfig } from "@libs/env"
import { UserClientService } from "@app/campaign/src/shared"
import { DonorRepository } from "../../repositories/donor.repository"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { DonationEmailService } from "./donation-email.service"
import { BadgeAwardService } from "./badge-award.service"

interface SepayWebhookPayload {
    id: number
    gateway: string
    transactionDate: string
    accountNumber: string
    code: string | null
    content: string
    transferType: string
    transferAmount: number
    accumulated: number
    subAccount: string | null
    referenceCode: string
    description: string
}

@Injectable()
export class SepayWebhookService {
    private readonly logger = new Logger(SepayWebhookService.name)

    constructor(
        private readonly userClientService: UserClientService,
        private readonly redisService: RedisService,
        private readonly donorRepository: DonorRepository,
        private readonly eventEmitter: EventEmitter2,
        private readonly donationEmailService: DonationEmailService,
        private readonly badgeAwardService: BadgeAwardService,
    ) { }

    async handleSepayWebhook(payload: SepayWebhookPayload): Promise<void> {
        this.logger.log("[Sepay] Received webhook:", {
            id: payload.id,
            amount: payload.transferAmount,
            content: payload.content,
            referenceCode: payload.referenceCode,
            gateway: payload.gateway,
            transferType: payload.transferType,
        })

        if (payload.transferType === "out") {
            this.logger.log(`[Sepay] Processing outgoing transfer: ${payload.id}`)
            await this.handleOutgoingTransfer(payload)
            return
        }

        if (payload.transferType !== "in") {
            this.logger.log(`[Sepay] Ignoring unknown transfer type: ${payload.transferType}`)
            return
        }

        const isDuplicate = await this.checkIdempotency(
            payload.id,
            payload.referenceCode,
        )
        if (isDuplicate) {
            this.logger.log(`[Sepay] Duplicate webhook ignored: ${payload.id}`)
            return
        }

        const orderCode = this.extractOrderCodeFromContent(payload.content)

        if (orderCode) {
            await this.handlePayOSRelatedTransfer(payload, orderCode)
        } else {
            this.logger.log(
                "[Sepay] No orderCode detected - routing to Admin Wallet",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    private async handlePayOSRelatedTransfer(
        payload: SepayWebhookPayload,
        orderCode: string,
    ): Promise<void> {
        try {
            this.logger.log(
                `[Sepay] Detected orderCode=${orderCode}, checking payment status`,
            )

            const existingPayment = await this.donorRepository.findPaymentBySepayId(payload.id)
            if (existingPayment) {
                this.logger.log(
                    `[Sepay] ⚠️ Skipping - sepayId ${payload.id} already processed (Payment: ${existingPayment.id})`,
                )
                return
            }

            const paymentTransaction =
                await this.donorRepository.findPaymentTransactionByOrderCode(
                    BigInt(orderCode),
                )

            if (!paymentTransaction) {
                this.logger.warn(
                    `[Sepay] Payment transaction not found for orderCode=${orderCode} - routing to Admin as regular transfer`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const sepayAmount = BigInt(payload.transferAmount)
            const originalAmount = paymentTransaction.amount

            if (sepayAmount >= originalAmount) {
                this.logger.log(
                    `[Sepay] ⚠️ Skipping - Sepay amount (${sepayAmount}) >= original (${originalAmount}). PayOS webhook will handle this to avoid duplicate.`,
                )
                return
            }

            if (!paymentTransaction.processed_by_webhook) {
                this.logger.log(
                    `[Sepay] 💰 Processing initial PARTIAL payment - ${sepayAmount}/${originalAmount}`,
                )
                await this.processPartialPaymentToAdmin(payload, paymentTransaction, orderCode)
                return
            }

            this.logger.log(
                `[Sepay] 💰 Processing SUPPLEMENTARY payment - amount=${sepayAmount} (original already processed)`,
            )
            await this.processSupplementaryPayment(payload, paymentTransaction)

        } catch (error) {
            this.logger.error(
                `[Sepay] ❌ Failed to handle PayOS-related transfer - orderCode=${orderCode}`,
                error.stack,
            )
            this.logger.log(
                "[Sepay] Fallback: Routing to Admin Wallet instead",
            )
            await this.routeToAdminWallet(payload)
        }
    }

    private async processPartialPaymentToAdmin(
        payload: SepayWebhookPayload,
        paymentTransaction: any,
        orderCode: string,
    ): Promise<void> {
        try {
            const donation = paymentTransaction.donation
            if (!donation || !donation.campaign) {
                this.logger.error(
                    `[Sepay→Admin] Donation or campaign not found for payment ${paymentTransaction.id}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const outboxPayload = {
                orderCode: orderCode,
                amount: payload.transferAmount.toString(),
                paymentTransactionId: paymentTransaction.id,
                donorId: donation.donor_id,
                campaignId: donation.campaign_id,
                donorName: donation.donor_name,
                gateway: "SEPAY"
            }

            await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                amount_paid: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                processed_by_webhook: true,
                sepay_metadata: {
                    sepay_id: payload.id,
                    reference_code: payload.referenceCode,
                    content: payload.content,
                    bank_name: payload.gateway,
                    transaction_date: payload.transactionDate,
                    accumulated: payload.accumulated,
                    sub_account: payload.subAccount,
                    description: payload.description,
                },
                outbox_event: {
                    event_type: "DONATION_PAYMENT_SUCCEEDED",
                    payload: outboxPayload
                }
            })

            this.logger.log(
                `[Sepay→Admin] ✅ Payment updated & Outbox event created - orderCode=${orderCode}`,
            )

            // this.checkAndEmitSurplusEvent(result.campaign)

            // const adminUserId = this.getSystemAdminId()

            // await this.userClientService.creditAdminWallet({
            //     adminId: adminUserId,
            //     campaignId: campaignId,
            //     paymentTransactionId: paymentTransaction.id,
            //     amount: BigInt(payload.transferAmount),
            //     gateway: "SEPAY",
            //     description: `Thanh toán qua Sepay - Đơn hàng ${orderCode} | Ref: ${payload.referenceCode}`,
            // })

            // this.logger.log(
            //     `[Sepay→Admin] ✅ Admin wallet credited - orderCode=${orderCode}, amount=${payload.transferAmount}`,
            // )

            // await this.donationEmailService.sendDonationConfirmation(
            //     donation,
            //     BigInt(payload.transferAmount),
            //     donation.campaign,
            //     "Sepay",
            // )

            // if (donation.donor_id) {
            //     const donor = await this.userClientService.getUserByCognitoId(donation.donor_id)

            //     if (donor) {
            //         await this.userClientService.updateDonorStats({
            //             donorId: donor.id,
            //             amountToAdd: BigInt(payload.transferAmount),
            //             incrementCount: 1,
            //             lastDonationAt: new Date(),
            //         })

            //         this.awardBadgeAsync(donor.id)
            //     } else {
            //         this.logger.warn(
            //             `[Sepay→Admin] Donor not found for cognito_id: ${donation.donor_id}`,
            //         )
            //     }
            // }
        } catch (error) {
            this.logger.error(
                `[Sepay→Admin] ❌ Failed to process partial payment - orderCode=${orderCode}`,
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

    private async processSupplementaryPayment(
        payload: SepayWebhookPayload,
        originalPayment: any,
    ): Promise<void> {
        try {
            const donation = originalPayment.donation
            if (!donation || !donation.campaign) {
                this.logger.error(
                    `[Sepay→Admin] Donation or campaign not found for original payment ${originalPayment.id}`,
                )
                await this.routeToAdminWallet(payload)
                return
            }

            const outboxPayload = {
                orderCode: "SUPPLEMENTARY",
                amount: payload.transferAmount.toString(),
                paymentTransactionId: "",
                donorId: donation.donor_id,
                campaignId: donation.campaign_id,
                donorName: donation.donor_name,
                gateway: "SEPAY"
            }
            const donationId = donation.id

            await this.donorRepository.createSupplementaryPayment({
                donation_id: donationId,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: `Thanh toán qua Sepay | Ref: ${payload.referenceCode}`,
                sepay_metadata: {
                    sepayId: payload.id,
                    referenceCode: payload.referenceCode,
                    content: payload.content,
                    bankName: payload.gateway,
                    transactionDate: payload.transactionDate,
                    accumulated: payload.accumulated,
                    subAccount: payload.subAccount,
                    description: payload.description,
                },
                outbox_event: {
                    event_type: "DONATION_PAYMENT_SUCCEEDED",
                    payload: outboxPayload
                }
            })

            this.logger.log(
                "[Sepay→Admin] ✅ Supplementary payment created & Outbox event created",
            )

        } catch (error) {
            this.logger.error(
                "[Sepay→Admin] ❌ Failed to process supplementary payment",
                error.stack,
            )
            throw error
        }
    }

    private async routeToAdminWallet(
        payload: SepayWebhookPayload,
    ): Promise<void> {
        try {
            const adminUserId = this.getSystemAdminId()

            this.logger.log(
                `[Sepay→Admin] Routing non-donation transfer to Admin Wallet - Admin ID: ${adminUserId}`,
            )


            await this.userClientService.creditAdminWallet({
                adminId: adminUserId,
                campaignId: null,
                paymentTransactionId: null,
                amount: BigInt(payload.transferAmount),
                gateway: "SEPAY",
                description: this.buildDescription(payload),
                sepayMetadata: {
                    sepayId: payload.id,
                    referenceCode: payload.referenceCode,
                    content: payload.content,
                    bankName: payload.gateway,
                    transactionDate: payload.transactionDate,
                    accumulated: payload.accumulated,
                    subAccount: payload.subAccount,
                    description: payload.description,
                },
            })

            this.logger.log(
                `[Sepay→Admin] ✅ Admin Wallet credited (non-donation) - Sepay ID: ${payload.id}, Amount: ${payload.transferAmount}`,
            )
        } catch (error) {
            if (error.message?.includes("ADMIN wallet not found")) {
                this.logger.warn(
                    `[Sepay→Admin] ⚠️ Admin wallet not found - skipping transfer routing. Please create admin wallet first. Transfer ID: ${payload.id}, Amount: ${payload.transferAmount}`,
                )
                this.logger.warn(
                    `[Sepay→Admin] Transfer details: Ref=${payload.referenceCode}, Bank=${payload.gateway}, Content="${payload.content}"`,
                )
                return
            }

            this.logger.error(
                `[Sepay→Admin] ❌ Failed to route to Admin Wallet - ID: ${payload.id}`,
                error.stack,
            )
            throw error
        }
    }

    /**
     * Extract orderCode from Sepay transfer content
     * OrderCode format: {timestamp}{randomSuffix} = 13 digits + 3 digits = 16 digits total
     * Example: 1762653025868727
     * 
     * Sepay content example:
     * "ZP253130089790 251109000580175 CSF3FD8XUZ2 1762653025868727 GD 089790-110925 08:51:02"
     */
    private extractOrderCodeFromContent(content: string): string | null {
        try {
            const sixteenDigitPattern = /\b(\d{16})\b/g
            const matches = content.match(sixteenDigitPattern)

            if (matches && matches.length > 0) {
                // If multiple 16-digit numbers, take the first one
                const orderCode = matches[0]

                this.logger.debug(
                    `[Sepay] Extracted orderCode: ${orderCode} from content: "${content}"`,
                )
                return orderCode
            }

            this.logger.debug(
                `[Sepay] No 16-digit orderCode found in content: "${content}"`,
            )
            return null
        } catch (error) {
            this.logger.error(
                `[Sepay] Failed to extract orderCode from content: "${content}"`,
                error,
            )
            return null
        }
    }

    private buildDescription(payload: SepayWebhookPayload): string {
        return `Chuyển khoản đến Sepay - Ref: ${payload.referenceCode} | Content: ${payload.content} | Bank: ${payload.gateway}`
    }

    private async checkIdempotency(
        sepayId: number,
        referenceCode: string,
    ): Promise<boolean> {
        try {
            const cacheKey = `sepay:webhook:${sepayId}:${referenceCode}`

            const exists = await this.redisService.exists(cacheKey)

            if (exists) {
                return true
            }

            const ttl = 7 * 24 * 60 * 60 // 7 days in seconds
            await this.redisService.set(cacheKey, "processed", { ex: ttl })

            return false
        } catch (error) {
            this.logger.error(
                `[Sepay] Failed to check idempotency for ${sepayId}:`,
                error,
            )
            return false
        }
    }


    private async handleOutgoingTransfer(
        payload: SepayWebhookPayload,
    ): Promise<void> {
        try {
            this.logger.log(
                `[Sepay OUT] Processing bank transfer OUT - Amount: ${payload.transferAmount}, Gateway: ${payload.gateway}`,
            )

            await this.userClientService.processBankTransferOut({
                sepayId: payload.id,
                amount: BigInt(payload.transferAmount),
                gateway: payload.gateway,
                referenceCode: payload.referenceCode,
                content: payload.content,
                transactionDate: payload.transactionDate,
                description: payload.description,
            })

            this.logger.log(
                `[Sepay OUT] ✅ Successfully processed withdrawal - Sepay ID: ${payload.id}`,
            )
        } catch (error) {
            this.logger.error(
                `[Sepay OUT] ❌ Failed to process outgoing transfer: ${error.message}`,
                error.stack,
            )
        }
    }

    private getSystemAdminId(): string {
        const adminId = envConfig().systemAdminId || "admin-system-001"
        return adminId
    }

}
