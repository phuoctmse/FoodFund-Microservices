import { Injectable, Logger } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { PayOS } from "@payos/node"

export interface CreatePaymentLinkInput {
    orderCode: number
    amount: number
    description: string
    returnUrl?: string
    cancelUrl?: string
}

export interface PaymentLinkResponse {
    bin: string
    accountNumber: string
    accountName: string
    amount: number
    description: string
    orderCode: number
    currency: string
    paymentLinkId: string
    status: string
    checkoutUrl: string
    qrCode: string
}

@Injectable()
export class PayOSService {
    private readonly logger = new Logger(PayOSService.name)
    private readonly payos: PayOS

    constructor() {
        const config = envConfig()

        this.payos = new PayOS({
            clientId: config.payos.payosClienId,
            apiKey: config.payos.payosApiKey,
            checksumKey: config.payos.payosCheckSumKey,
        })

        this.logger.log("[PayOS SDK] Initialized successfully")
    }

    async createPaymentLink(
        input: CreatePaymentLinkInput,
    ): Promise<PaymentLinkResponse> {
        try {
            // Validate and sanitize input according to PayOS requirements
            const sanitizedInput = this.validateAndSanitizeInput(input)

            const paymentData = {
                orderCode: sanitizedInput.orderCode,
                amount: sanitizedInput.amount,
                description: sanitizedInput.description,
                returnUrl: sanitizedInput.returnUrl || "",
                cancelUrl: sanitizedInput.cancelUrl || "",
            }

            this.logger.log(
                `[PayOS SDK] Creating payment link for order ${input.orderCode}`,
            )

            const response =
                await this.payos.paymentRequests.create(paymentData)

            this.logger.log(
                `[PayOS SDK] Payment link created: ${response.paymentLinkId}`,
            )

            return response as PaymentLinkResponse
        } catch (error) {
            this.logger.error(
                `[PayOS SDK] Failed to create payment link: ${error.message}`,
            )
            throw error
        }
    }

    async getPaymentLinkInfo(orderCode: number): Promise<PaymentLinkResponse> {
        try {
            this.logger.log(
                `[PayOS SDK] Getting payment info for order ${orderCode}`,
            )

            const response = await this.payos.paymentRequests.get(orderCode)

            return response as any as PaymentLinkResponse
        } catch (error) {
            this.logger.error(
                `[PayOS SDK] Failed to get payment link info: ${error.message}`,
            )
            throw error
        }
    }

    async cancelPaymentLink(
        orderCode: number,
        cancellationReason?: string,
    ): Promise<void> {
        try {
            this.logger.log(
                `[PayOS SDK] Cancelling payment link for order ${orderCode}`,
            )

            await this.payos.paymentRequests.cancel(
                orderCode,
                cancellationReason,
            )

            this.logger.log(
                `[PayOS SDK] Payment link cancelled for order ${orderCode}`,
            )
        } catch (error) {
            this.logger.error(
                `[PayOS SDK] Failed to cancel payment link: ${error.message}`,
            )
            throw error
        }
    }

    /**
     * Validate and sanitize input according to PayOS requirements
     */
    private validateAndSanitizeInput(
        input: CreatePaymentLinkInput,
    ): CreatePaymentLinkInput {
        // PayOS requirements:
        // - description: Maximum 25 characters
        // - amount: Must be positive integer
        // - orderCode: Must be unique integer

        let sanitizedDescription = input.description

        // Truncate description to 25 characters max
        if (sanitizedDescription && sanitizedDescription.length > 25) {
            sanitizedDescription = sanitizedDescription.substring(0, 25)
            this.logger.warn(
                `Description truncated from ${input.description.length} to 25 characters`,
                {
                    original: input.description,
                    truncated: sanitizedDescription,
                },
            )
        }

        // Validate amount
        if (!input.amount || input.amount <= 0) {
            throw new Error("Amount must be a positive number")
        }

        // Validate orderCode
        if (!input.orderCode) {
            throw new Error("OrderCode is required")
        }

        const sanitizedInput: CreatePaymentLinkInput = {
            orderCode: input.orderCode,
            amount: Math.floor(input.amount), // Ensure integer
            description: sanitizedDescription,
            returnUrl: input.returnUrl,
            cancelUrl: input.cancelUrl,
        }

        return sanitizedInput
    }

    /**
     * Verify webhook data from PayOS using SDK
     * Used to validate incoming webhook requests
     */
    async verifyWebhookData(webhook: any): Promise<any> {
        try {
            this.logger.log("[PayOS SDK] Verifying webhook data")

            const verifiedData = await this.payos.webhooks.verify(webhook)

            this.logger.log("[PayOS SDK] Webhook verified successfully")

            return verifiedData
        } catch (error) {
            this.logger.error(
                "[PayOS SDK] Failed to verify webhook:",
                error.message,
            )
            throw error
        }
    }
}
