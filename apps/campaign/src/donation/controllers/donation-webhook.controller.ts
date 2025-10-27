import {
    Controller,
    Post,
    Body,
    Logger,
    HttpCode,
    HttpStatus,
} from "@nestjs/common"
import { DonationWebhookService } from "../services/donation-webhook.service"
import { SepayWebhookPayload } from "@libs/sepay"

@Controller("webhooks/sepay")
export class DonationWebhookController {
    private readonly logger = new Logger(DonationWebhookController.name)

    constructor(private readonly webhookService: DonationWebhookService) {}

    @Post("payment")
    @HttpCode(HttpStatus.OK)
    async handlePaymentWebhook(
        @Body() payload: SepayWebhookPayload,
    ): Promise<{ success: boolean; message: string }> {
        this.logger.log(`Received Sepay webhook for transaction ${payload.id}`)

        try {
            console.debug(payload)

            await this.webhookService.handlePaymentWebhook(payload)

            return {
                success: true,
                message: "Webhook processed successfully",
            }
        } catch (error) {
            this.logger.error(
                `Failed to process webhook: ${error.message}`,
                error.stack,
            )

            // IMPORTANT: Always return 200 OK to Sepay
            // This prevents Sepay from retrying the webhook
            // We log the error for manual review instead
            return {
                success: true,
                message: "Webhook received",
            }
        }
    }
}
