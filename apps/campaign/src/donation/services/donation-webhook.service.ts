import { Injectable, Logger } from "@nestjs/common"
import { DonorRepository } from "../repositories/donor.repository"
import { UserClientService } from "../../shared/services/user-client.service"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"
import { PaymentStatus } from "../../shared/enum/campaign.enum"

interface PayOSWebhookData {
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

@Injectable()
export class DonationWebhookService {
    private readonly logger = new Logger(DonationWebhookService.name)
    private payOS: PayOS | null = null

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly userClientService: UserClientService,
    ) {}

    private getPayOS(): PayOS {
        if (!this.payOS) {
            const config = envConfig().payos
            if (!config.payosClienId || !config.payosApiKey || !config.payosCheckSumKey) {
                throw new Error("PayOS credentials are not configured. Please set PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY in environment variables.")
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
        const { orderCode, code, desc } = webhookData

        this.logger.log(`[PayOS] Received webhook for order ${orderCode}`, {
            code,
            desc,
        })

        // Verify webhook signature (PayOS provides verification method)
        // Note: You need to implement signature verification based on PayOS docs

        // Find payment transaction by order_code
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

        // Check if already processed
        if (paymentTransaction.status === PaymentStatus.SUCCESS) {
            this.logger.log(
                `[PayOS] Payment already processed for order ${orderCode}`,
            )
            return
        }

        // Update payment status based on webhook code
        if (code === "00") {
            // Payment successful
            await this.donorRepository.updatePaymentTransactionSuccess({
                order_code: BigInt(orderCode),
                reference: webhookData.reference,
                transaction_datetime: new Date(webhookData.transactionDateTime),
                counter_account_bank_id: webhookData.counterAccountBankId,
                counter_account_bank_name: webhookData.counterAccountBankName,
                counter_account_name: webhookData.counterAccountName,
                counter_account_number: webhookData.counterAccountNumber,
                virtual_account_name: webhookData.virtualAccountName,
                virtual_account_number: webhookData.virtualAccountNumber,
            })

            this.logger.log(`[PayOS] Payment successful for order ${orderCode}`)
        } else {
            // Payment failed
            await this.donorRepository.updatePaymentTransactionFailed({
                order_code: BigInt(orderCode),
                error_code: code,
                error_description: desc,
            })

            this.logger.warn(`[PayOS] Payment failed for order ${orderCode}`, {
                code,
                desc,
            })
        }
    }
}
