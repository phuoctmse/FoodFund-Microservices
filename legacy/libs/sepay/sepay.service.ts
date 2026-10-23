import { Injectable, Logger } from "@nestjs/common"
import axios, { AxiosInstance } from "axios"
import {
    SepayQRRequest,
    SepayQRResponse,
    SepayAccountInfo,
} from "./sepay.types"
import { envConfig } from "@libs/env"

@Injectable()
export class SepayService {
    private readonly logger = new Logger(SepayService.name)
    private readonly client: AxiosInstance
    private readonly accountInfo: SepayAccountInfo

    constructor() {
        const env = envConfig()
        const apiKey = env.sepay.sepayApiKey
        const accountNumber = env.sepay.sepayAccountNumber
        const accountName = env.sepay.sepayAccountName
        const bankName = env.sepay.sepayBankName
        const bankShortName = env.sepay.sepayShortBankName

        if (!apiKey) {
            throw new Error("SEPAY_API_KEY is required")
        }

        if (!accountNumber || !accountName) {
            throw new Error(
                "SEPAY_ACCOUNT_NUMBER and SEPAY_ACCOUNT_NAME are required",
            )
        }

        this.accountInfo = {
            account_number: accountNumber,
            account_name: accountName,
            bank_name: bankName,
            bank_short_name: bankShortName,
            bank_code: bankShortName, // Use short name as bank code (e.g., "MB")
        }

        this.client = axios.create({
            baseURL: "https://my.sepay.vn/userapi",
            timeout: 10000,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        })
    }

    /**
     * Generate dynamic QR code
     * Docs: https://docs.sepay.vn/tich-hop-webhooks.html
     */
    async generateQRCode(params: {
        amount: number // 0 = user can input any amount
        content: string // Transfer description
    }): Promise<string> {
        try {
            const request: SepayQRRequest = {
                account_number: this.accountInfo.account_number,
                account_name: this.accountInfo.account_name,
                amount: params.amount,
                content: params.content,
            }

            this.logger.log("[SEPAY] Generating QR code", {
                amount: params.amount,
                content: params.content,
            })

            const response = await this.client.post<SepayQRResponse>(
                "/create-qr",
                request,
            )

            if (
                response.data.status === 200 &&
                response.data.messages.success
            ) {
                const qrBase64 = response.data.messages.data.qr
                // Convert to data URL format
                return `data:image/png;base64,${qrBase64}`
            }

            throw new Error(
                `Sepay API error: ${response.data.messages.message || "Unknown error"}`,
            )
        } catch (error) {
            this.logger.error("[SEPAY] Failed to generate QR code", {
                error: error instanceof Error ? error.message : error,
                params,
            })
            throw error
        }
    }

    /**
     * Get account info
     */
    getAccountInfo(): SepayAccountInfo {
        return this.accountInfo
    }

    /**
     * Verify webhook payload structure
     * Sepay doesn't have signature verification
     * So we just validate the payload structure
     */
    validateWebhook(payload: any): boolean {
        return (
            payload &&
            typeof payload.id === "number" &&
            typeof payload.content === "string" &&
            typeof payload.transferAmount === "number" &&
            typeof payload.referenceCode === "string" &&
            typeof payload.gateway === "string"
        )
    }
}
