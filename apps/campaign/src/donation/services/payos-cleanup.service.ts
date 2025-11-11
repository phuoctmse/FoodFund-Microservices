import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { DonorRepository } from "../repositories/donor.repository"
import { PaymentStatus } from "../../shared/enum/campaign.enum"
import { envConfig } from "@libs/env"
import { PayOS } from "@payos/node"

@Injectable()
export class PayosCleanupService {
    private readonly logger = new Logger(PayosCleanupService.name)
    private payOS: PayOS | null = null

    constructor(private readonly donorRepository: DonorRepository) {}

    private getPayOS(): PayOS {
        if (!this.payOS) {
            const config = envConfig().payos
            if (
                !config.payosClienId ||
                !config.payosApiKey ||
                !config.payosCheckSumKey
            ) {
                throw new Error(
                    "PayOS is not configured. Please contact administrator.",
                )
            }

            this.payOS = new PayOS({
                clientId: config.payosClienId,
                apiKey: config.payosApiKey,
                checksumKey: config.payosCheckSumKey,
            })
        }
        return this.payOS
    }

    /**
     * Run daily to cancel stale pending PayOS payment links
     * Criteria: status = PENDING and created_at older than X hours (configurable)
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cancelStalePendingPaymentLinks(): Promise<void> {
        const hours = Number(process.env.PAYOS_CANCEL_PENDING_AFTER_HOURS || 24)
        const threshold = new Date(Date.now() - hours * 60 * 60 * 1000)

        this.logger.log(
            `Starting PayOS cleanup job. Cancelling PENDING links older than ${hours}h (before ${threshold.toISOString()})`,
        )

        // Fetch pending PayOS links from DB
        const pending = await this.donorRepository.findPendingPayosLinksBefore(
            threshold,
            500,
        )

        this.logger.log(`Found ${pending.length} pending links to check`)

        const payos = this.getPayOS()

        for (const tx of pending) {
            try {
                const orderCodeNumber = tx.order_code
                    ? Number(tx.order_code)
                    : undefined

                // Extract payment_link_id from JSONB metadata
                const paymentLinkId = (tx.payos_metadata as any)?.payment_link_id

                // Fetch latest status from PayOS
                // SDK supports querying by paymentLinkId or orderCode
                const info = await (payos as any).getPaymentLinkInformation({
                    paymentLinkId: paymentLinkId || undefined,
                    orderCode: orderCodeNumber,
                })

                const payosStatus: string = info?.status || ""
                const payosCreatedAt: string | undefined = info?.createdAt

                const createdAt = payosCreatedAt
                    ? new Date(payosCreatedAt)
                    : tx.created_at

                // If still pending and createdAt is before threshold, cancel it
                if (
                    payosStatus?.toUpperCase() === "PENDING" &&
                    createdAt < threshold
                ) {
                    this.logger.log(
                        `Cancelling PayOS link - orderCode=${orderCodeNumber} paymentLinkId=${paymentLinkId}`,
                    )

                    await (payos as any).cancelPaymentLink({
                        paymentLinkId: paymentLinkId || undefined,
                        orderCode: orderCodeNumber,
                    })

                    // Mark as FAILED (cancelled) in DB
                    await this.donorRepository.updatePaymentTransactionFailed({
                        order_code: tx.order_code!,
                        gateway: "PAYOS",
                        processed_by_webhook: false,
                        error_code: "CANCELLED",
                        error_description: `Auto-cancelled pending PayOS link after ${hours}h (cron)`,
                    })

                    this.logger.log(
                        `✅ Cancelled and marked FAILED - orderCode=${orderCodeNumber}`,
                    )
                } else {
                    this.logger.log(
                        `Skipping - status=${payosStatus} createdAt=${createdAt.toISOString()} orderCode=${orderCodeNumber}`,
                    )
                }
            } catch (error) {
                this.logger.error(
                    `❌ Error processing tx id=${tx.id} orderCode=${tx.order_code?.toString()}: ${error.message}`,
                    error.stack,
                )
                // Continue with next transaction
            }
        }

        this.logger.log("PayOS cleanup job finished")
    }
}
