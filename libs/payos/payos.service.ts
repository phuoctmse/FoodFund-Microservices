import { Injectable, Logger } from "@nestjs/common"
import { envConfig } from "@libs/env"
import axios, { AxiosInstance } from "axios"
import * as crypto from "node:crypto"

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
    private readonly client: AxiosInstance
    private readonly apiKey: string
    private readonly clientId: string
    private readonly checksumKey: string

    constructor() {
        const config = envConfig()

        this.apiKey = config.payos.payosApiKey
        this.clientId = config.payos.payosClienId
        this.checksumKey = config.payos.payosCheckSumKey

        this.client = axios.create({
            baseURL: "https://api-merchant.payos.vn",
            headers: {
                "x-client-id": this.clientId,
                "x-api-key": this.apiKey,
            },
        })
    }

    async createPaymentLink(
        input: CreatePaymentLinkInput,
    ): Promise<PaymentLinkResponse> {
        try {
            // Validate and sanitize input according to PayOS requirements
            const sanitizedInput = this.validateAndSanitizeInput(input)

            const signature = this.generateSignature(sanitizedInput)

            const requestBody = {
                orderCode: sanitizedInput.orderCode,
                amount: sanitizedInput.amount,
                description: sanitizedInput.description,
                returnUrl: sanitizedInput.returnUrl,
                cancelUrl: sanitizedInput.cancelUrl,
                signature: signature,
            }

            console.log("Request body:", JSON.stringify(requestBody, null, 2))

            const response = await this.client.post(
                "/v2/payment-requests",
                requestBody,
            )

            this.logger.log(`Payment link created for order ${input.orderCode}`)
            return response.data.data
        } catch (error) {
            this.logger.error(`Failed to create payment link: ${error.message}`)
            throw error
        }
    }

    async getPaymentLinkInfo(orderCode: number): Promise<PaymentLinkResponse> {
        try {
            const response = await this.client.get(
                `/v2/payment-requests/${orderCode}`,
            )
            return response.data.data
        } catch (error) {
            this.logger.error(
                `Failed to get payment link info: ${error.message}`,
            )
            throw error
        }
    }

    async cancelPaymentLink(orderCode: number): Promise<void> {
        try {
            await this.client.put(`/v2/payment-requests/${orderCode}/cancel`)
            this.logger.log(`Payment link cancelled for order ${orderCode}`)
        } catch (error) {
            this.logger.error(`Failed to cancel payment link: ${error.message}`)
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

        console.log("Sanitized input:", sanitizedInput)
        return sanitizedInput
    }

    private generateSignature(input: CreatePaymentLinkInput): string {
        try {
            // Create data string sorted alphabetically by parameter names
            // PayOS format: amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl
            // Always include all 5 fields in correct order, even if empty
            const dataString =
                `amount=${input.amount}` +
                `&cancelUrl=${input.cancelUrl ?? ""}` +
                `&description=${input.description}` +
                `&orderCode=${input.orderCode}` +
                `&returnUrl=${input.returnUrl ?? ""}`

            // Generate HMAC SHA256 signature using checksum key
            const signature = crypto
                .createHmac("sha256", this.checksumKey)
                .update(dataString)
                .digest("hex")

            return signature
        } catch (error) {
            this.logger.error(
                "Failed to generate PayOS signature:",
                error.message,
            )
            throw new Error(`Signature generation failed: ${error.message}`)
        }
    }

    /**
     * Verify webhook signature from PayOS
     * Used to validate incoming webhook requests
     */
    verifyWebhookSignature(
        webhookData: any,
        receivedSignature: string,
    ): boolean {
        try {
            // Generate signature for webhook data
            const dataParams: string[] = []

            // Sort webhook data keys alphabetically and build string
            const sortedKeys = Object.keys(webhookData).sort((a, b) =>
                a.localeCompare(b),
            )

            for (const key of sortedKeys) {
                if (
                    webhookData[key] !== undefined &&
                    webhookData[key] !== null
                ) {
                    dataParams.push(`${key}=${webhookData[key]}`)
                }
            }

            const dataString = dataParams.join("&")

            const expectedSignature = crypto
                .createHmac("sha256", this.checksumKey)
                .update(dataString)
                .digest("hex")

            const isValid = expectedSignature === receivedSignature

            if (!isValid) {
                this.logger.warn(
                    "PayOS webhook signature verification failed",
                    {
                        expected: expectedSignature,
                        received: receivedSignature,
                        dataString,
                    },
                )
            }

            return isValid
        } catch (error) {
            this.logger.error(
                "Failed to verify PayOS webhook signature:",
                error.message,
            )
            return false
        }
    }
}
