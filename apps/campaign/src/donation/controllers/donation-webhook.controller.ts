import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from "@nestjs/common"
import { DonationWebhookService } from "../services/donation-webhook.service"

export interface PayOSWebhookPayload {
    code: string
    desc: string
    success: boolean
    data: {
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
        this.logger.log(`Received PayOS webhook for order ${payload.data?.orderCode}`)
        
        try {            
            // Verify webhook signature
            const signature = payload.signature
            if (!signature) {
                this.logger.error("Missing signature in webhook payload")
                return {
                    success: false,
                    message: "Missing signature"
                }
            }
            
            await this.webhookService.handlePaymentWebhook(payload, signature)
            
            return {
                success: true,
                message: "Webhook processed successfully"
            }
        } catch (error) {
            this.logger.error(`Failed to process webhook: ${error.message}`, error.stack)
            
            // Return success to PayOS even if processing fails
            // to prevent retries for invalid data
            return {
                success: false,
                message: error.message
            }
        }
    }
}
