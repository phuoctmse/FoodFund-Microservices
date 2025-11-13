import { DonationWebhookService } from "@app/campaign/src/application/services/donation/donation-webhook.service"
import {
    Controller,
    Post,
    Body,
    Logger,
    HttpCode,
    HttpStatus,
} from "@nestjs/common"

interface PayOSWebhookPayload {
    data: {
        orderCode: number
        amount: number // Payment link amount (original request)
        amountPaid?: number // Actual amount paid by user (may differ from amount)
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
    signature: string
}

@Controller("webhooks/payos")
export class DonationWebhookController {
    private readonly logger = new Logger(DonationWebhookController.name)

    constructor(private readonly webhookService: DonationWebhookService) {}

    @Post("payment")
    @HttpCode(HttpStatus.OK)
    async handlePaymentWebhook(
        @Body() payload: PayOSWebhookPayload,
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log(
            `Received PayOS webhook for order ${payload.data.orderCode}`,
        )

        try {
            await this.webhookService.handlePaymentWebhook(payload.data)

            return {
                success: true,
                message: "Webhook processed successfully",
            }
        } catch (error) {
            this.logger.error(
                `Failed to process webhook: ${error.message}`,
                error.stack,
            )

            // IMPORTANT: Always return 200 OK to PayOS
            // This prevents PayOS from retrying the webhook
            // We log the error for manual review instead
            return {
                success: true,
                message: "Webhook received",
            }
        }
    }
}
