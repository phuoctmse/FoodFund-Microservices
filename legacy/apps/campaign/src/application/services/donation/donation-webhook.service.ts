import { Injectable, Logger } from "@nestjs/common"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { DonorRepository } from "../../repositories/donor.repository"
import { UserClientService } from "@app/campaign/src/shared"
import { DonationEmailService } from "./donation-email.service"
import { BadgeAwardService } from "./badge-award.service"
import { CampaignFollowerService } from "../campaign/campaign-follower.service"
import { DonationSearchService } from "./donation-search.service"
import { CampaignCacheService } from "../campaign/campaign-cache.service"

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
        private readonly campaignCacheService: CampaignCacheService
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

        if (paymentTransaction.gateway === "SEPAY") {
            this.logger.log(
                `[PayOS] ⚠️ Skipping - Payment already processed by Sepay (PARTIAL payment) - orderCode=${orderCode}`,
            )
            return
        }

        if (
            paymentTransaction.processed_by_webhook &&
            paymentTransaction.gateway === "PAYOS"
        ) {
            this.logger.log(
                `[PayOS] Webhook already processed for order ${orderCode}`,
            )
            return
        }

        if (code === "00") {
            await this.processSuccessfulPayment(paymentTransaction, webhookData)
            if (paymentTransaction.donation?.campaign_id) {
                await this.invalidateCampaignCache(paymentTransaction.donation.campaign_id)
            }
        } else {
            await this.processFailedPayment(paymentTransaction, code, desc)
        }
    }

    private async processSuccessfulPayment(
        paymentTransaction: any,
        webhookData: PayOSWebhookData,
    ): Promise<void> {
        const { orderCode, amount, amountPaid } = webhookData

        try {
            const actualAmountReceived = BigInt(amountPaid || amount)
            const originalAmount = paymentTransaction.amount

            if (actualAmountReceived < originalAmount) {
                this.logger.warn(
                    `[PayOS] ⚠️ PARTIAL payment detected (${actualAmountReceived}/${originalAmount}) - This should be handled by Sepay. Skipping PayOS processing.`,
                )
                return
            }

            this.logger.log(
                `[PayOS] Processing ${actualAmountReceived === originalAmount ? "COMPLETED" : "OVERPAID"} payment - ${actualAmountReceived}/${originalAmount}`,
            )

            const outboxPayload = {
                orderCode: orderCode.toString(),
                amount: actualAmountReceived.toString(),
                paymentTransactionId: paymentTransaction.id,
                donorId: paymentTransaction.donation?.donor_id,
                campaignId: paymentTransaction.donation?.campaign_id,
                donorName: paymentTransaction.donation?.donor_name,
                gateway: "PAYOS"
            }

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
                outbox_event: {
                    event_type: "DONATION_PAYMENT_SUCCEEDED",
                    payload: outboxPayload
                }
            })

            this.logger.log(
                `[PayOS] ✅ Payment transaction updated & Outbox event created - Order ${orderCode}`,
            )

        } catch (error) {
            this.logger.error(
                `[PayOS] ❌ Failed to process successful payment for order ${orderCode}`,
                error.stack,
            )
            throw error
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

    private async invalidateCampaignCache(campaignId: string): Promise<void> {
        try {
            const campaign = await this.donorRepository.findCampaignById(campaignId)
            if (campaign) {
                await this.campaignCacheService.invalidateAll(campaignId, campaign.slug || undefined)
                this.logger.log(`[Cache] Invalidated cache for campaign ${campaignId} (slug: ${campaign.slug})`)
            }
        } catch (error) {
            this.logger.error(`[Cache] Failed to invalidate cache for campaign ${campaignId}`, error)
        }
    }
}
