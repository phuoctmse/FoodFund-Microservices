import { Injectable, Logger, BadRequestException } from "@nestjs/common"
import { PayOSService } from "@libs/payos"
import { PayOSWebhookPayload } from "../controllers/donation-webhook.controller"
import { DonorRepository } from "../repositories/donor.repository"
import { PaymentStatus } from "../../shared/enum/campaign.enum"

@Injectable()
export class DonationWebhookService {
    private readonly logger = new Logger(DonationWebhookService.name)

    constructor(
        private readonly payosService: PayOSService,
        private readonly DonorRepository: DonorRepository,
    ) {}

    async handlePaymentWebhook(
        payload: PayOSWebhookPayload,
        signature: string,
    ): Promise<void> {
        // Verify webhook signature
        const isValid = this.payosService.verifyWebhookSignature(
            payload.data,
            signature,
        )

        if (!isValid) {
            this.logger.warn("Invalid webhook signature", {
                orderCode: payload.data.orderCode,
            })
            throw new BadRequestException("Invalid webhook signature")
        }

        const { orderCode, code, desc } = payload.data

        // Find payment transaction by order code
        const paymentTransaction =
            await this.DonorRepository.findPaymentTransactionByOrderCode(
                BigInt(orderCode),
            )

        if (!paymentTransaction) {
            this.logger.warn(
                `Payment transaction not found for order ${orderCode}`,
            )
            throw new BadRequestException("Payment transaction not found")
        }

        // Check if already processed
        if (paymentTransaction.status === PaymentStatus.SUCCESS) {
            this.logger.log(`Payment already processed for order ${orderCode}`)
            return
        }

        // Update payment transaction status based on webhook code
        let newStatus: PaymentStatus

        if (code === "00") {
            // Payment successful
            newStatus = PaymentStatus.SUCCESS
            this.logger.log(`Payment successful for order ${orderCode}`)
        } else {
            // Payment failed
            newStatus = PaymentStatus.FAILED
            this.logger.warn(`Payment failed for order ${orderCode}: ${desc}`)
        }

        // Use transaction to ensure data consistency
        // Both payment update and campaign stats must succeed or rollback together
        await this.DonorRepository.updatePaymentWithTransaction(
            paymentTransaction.id,
            newStatus,
            {
                accountName: payload.data.counterAccountName,
                accountNumber: payload.data.counterAccountNumber,
                accountBankName: payload.data.counterAccountBankName,
                description: payload.data.description,
                transactionDateTime: payload.data.transactionDateTime,
            },
            // Only update campaign if payment successful
            newStatus === PaymentStatus.SUCCESS
                ? {
                    campaignId: paymentTransaction.donation.campaign_id,
                    amount: paymentTransaction.amount,
                }
                : undefined,
        )

        this.logger.log(`Webhook processed successfully for order ${orderCode}`)
    }
}
