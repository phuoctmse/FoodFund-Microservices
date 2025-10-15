import { Injectable, Inject, Logger } from "@nestjs/common"
import { PayOS } from "@payos/node"
import { MODULE_OPTIONS_TOKEN } from "./payos.module-definition"
import {
    PayOSConfig,
    PayOSPaymentData,
    PayOSPaymentResponse,
    PayOSWebhookData,
    PayOSPaymentLinkData,
    PayOSTransactionStatus,
    PayOSError,
} from "./payos.types"

@Injectable()
export class PayOSService {
    private readonly logger = new Logger(PayOSService.name)
    private readonly payOS: any

    constructor(@Inject(MODULE_OPTIONS_TOKEN) private config: PayOSConfig) {
        this.payOS = new PayOS({
            clientId: config.clientId,
            apiKey: config.apiKey,
            checksumKey: config.checksumKey,
        })
        
        this.logger.log(`PayOS initialized in ${config.environment || "sandbox"} mode`)
    }

    /**
     * Tạo payment link cho đơn hàng
     */
    async createPaymentLink(
        paymentData: PayOSPaymentLinkData,
    ): Promise<PayOSPaymentResponse> {
        try {
            this.logger.log(
                `Creating payment link for order: ${paymentData.orderCode}`,
            )

            const paymentLinkResponse = await this.payOS.createPaymentLink(
                paymentData,
            )

            this.logger.log(
                `Payment link created successfully: ${paymentLinkResponse.checkoutUrl}`,
            )

            return paymentLinkResponse
        } catch (error) {
            this.logger.error("Failed to create payment link:", error)
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Lấy thông tin payment link
     */
    async getPaymentLinkInformation(
        orderCode: number,
    ): Promise<PayOSTransactionStatus> {
        try {
            this.logger.log(`Getting payment info for order: ${orderCode}`)

            const paymentInfo = await this.payOS.getPaymentLinkInformation(
                orderCode,
            )

            return paymentInfo
        } catch (error) {
            this.logger.error(
                `Failed to get payment info for order ${orderCode}:`,
                error,
            )
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Hủy payment link
     */
    async cancelPaymentLink(
        orderCode: number,
        cancellationReason?: string,
    ): Promise<PayOSTransactionStatus> {
        try {
            this.logger.log(`Cancelling payment link for order: ${orderCode}`)

            const result = await this.payOS.cancelPaymentLink(
                orderCode,
                cancellationReason,
            )

            this.logger.log(
                `Payment link cancelled successfully for order: ${orderCode}`,
            )

            return result
        } catch (error) {
            this.logger.error(
                `Failed to cancel payment link for order ${orderCode}:`,
                error,
            )
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Xác thực webhook data từ PayOS
     */
    verifyPaymentWebhookData(webhookData: PayOSWebhookData): PayOSWebhookData {
        try {
            this.logger.log(
                `Verifying webhook data for order: ${webhookData.orderCode}`,
            )

            const verifiedData = this.payOS.verifyPaymentWebhookData(webhookData)

            this.logger.log(
                `Webhook data verified successfully for order: ${webhookData.orderCode}`,
            )

            return verifiedData
        } catch (error) {
            this.logger.error("Failed to verify webhook data:", error)
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Tạo QR code cho thanh toán
     */
    async generateQRCode(
        paymentData: PayOSPaymentData,
    ): Promise<{ qrCodeUrl: string }> {
        try {
            this.logger.log(
                `Generating QR code for order: ${paymentData.orderCode}`,
            )

            // PayOS sẽ trả về QR code trong response của createPaymentLink
            const paymentLink = await this.createPaymentLink(paymentData)

            return {
                qrCodeUrl: paymentLink.qrCode,
            }
        } catch (error) {
            this.logger.error("Failed to generate QR code:", error)
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Kiểm tra trạng thái giao dịch
     */
    async checkTransactionStatus(
        orderCode: number,
    ): Promise<"PENDING" | "PROCESSING" | "PAID" | "CANCELLED"> {
        try {
            const paymentInfo = await this.getPaymentLinkInformation(orderCode)
            return paymentInfo.status
        } catch (error) {
            this.logger.error(
                `Failed to check transaction status for order ${orderCode}:`,
                error,
            )
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Tạo chữ ký cho webhook
     */
    createWebhookSignature(data: any): string {
        try {
            return this.payOS.createWebhookSignature(data)
        } catch (error) {
            this.logger.error("Failed to create webhook signature:", error)
            throw this.handlePayOSError(error)
        }
    }

    /**
     * Handle PayOS errors và convert thành NestJS compatible errors
     */
    private handlePayOSError(error: any): Error {
        if (error?.response?.data) {
            const payosError: PayOSError = {
                code: error.response.data.code || "UNKNOWN_ERROR",
                desc: error.response.data.desc || "Unknown PayOS error",
                data: error.response.data.data,
            }

            return new Error(
                `PayOS Error [${payosError.code}]: ${payosError.desc}`,
            )
        }

        return error instanceof Error ? error : new Error(String(error))
    }

    // /**
    //  * Utility: Tạo order code unique
    //  */
    // generateOrderCode(): number {
    //     return Math.floor(Math.random() * 9007199254740991) // Max safe integer
    // }

    /**
     * Utility: Format amount cho PayOS (VND, không có số thập phân)
     */
    formatAmount(amount: number): number {
        return Math.round(amount)
    }

    /**
     * Utility: Tạo signature cho payment data
     */
    createPaymentSignature(paymentData: PayOSPaymentData): string {
        try {
            return this.payOS.createPaymentSignature(paymentData)
        } catch (error) {
            this.logger.error("Failed to create payment signature:", error)
            throw this.handlePayOSError(error)
        }
    }
}