import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
    Headers,
} from "@nestjs/common"
import { SepayWebhookService } from "../services/sepay-webhook.service"

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

@Controller("webhooks/sepay")
export class SepayWebhookController {
    private readonly logger = new Logger(SepayWebhookController.name)

    constructor(private readonly sepayWebhookService: SepayWebhookService) {}

    @Post("transfer")
    @HttpCode(HttpStatus.OK)
    async handleTransferWebhook(
        @Body() payload: SepayWebhookPayload,
        @Headers("x-sepay-signature") signature?: string,
    ): Promise<{ success: boolean; message: string }> {
        try {
            this.logger.log("[Sepay Webhook] Received transfer notification:", {
                id: payload.id,
                amount: payload.transferAmount,
                type: payload.transferType,
                referenceCode: payload.referenceCode,
            })

            // TODO: Implement webhook signature verification
            // if (!this.verifySignature(payload, signature)) {
            //     this.logger.warn('[Sepay Webhook] Invalid signature');
            //     throw new UnauthorizedException('Invalid webhook signature');
            // }

            // Process webhook (async - will not block response)
            await this.sepayWebhookService.handleSepayWebhook(payload)

            return {
                success: true,
                message: "Webhook processed successfully",
            }
        } catch (error) {
            this.logger.error(
                "[Sepay Webhook] Failed to process webhook:",
                error.stack,
            )

            // Return 200 OK to prevent Sepay from retrying
            // Log the error for manual investigation
            return {
                success: false,
                message: "Webhook processing failed, logged for review",
            }
        }
    }

    /**
     * Verify webhook signature (if Sepay provides this feature)
     * TODO: Implement based on Sepay documentation
     */
    // private verifySignature(
    //     payload: SepayWebhookPayload,
    //     signature?: string,
    // ): boolean {
    //     if (!signature) return false;
    //
    //     // Implement signature verification logic
    //     // Example: HMAC-SHA256 with secret key
    //     return true;
    // }
}
