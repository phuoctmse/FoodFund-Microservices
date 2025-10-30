import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { PrismaClient } from "../../generated/campaign-client"
import { PaymentStatus } from "../../shared/enum/campaign.enum"
import { PayOS } from "@payos/node"
import { envConfig } from "@libs/env"

@Injectable()
export class PaymentCleanupService {
    private readonly logger = new Logger(PaymentCleanupService.name)
    private payOS: PayOS | null = null

    constructor(private readonly prisma: PrismaClient) {}

    private getPayOS(): PayOS {
        if (!this.payOS) {
            const config = envConfig().payos
            this.payOS = new PayOS({
                clientId: config.payosClienId,
                apiKey: config.payosApiKey,
                checksumKey: config.payosCheckSumKey,
            })
        }
        return this.payOS
    }

    /**
     * Run every day at 2 AM to cancel expired pending payments
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cancelExpiredPendingPayments() {
        this.logger.log("Starting expired pending payments cleanup...")

        try {
            // Find all PENDING payments older than 24 hours
            const twentyFourHoursAgo = new Date()
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

            const expiredPayments = await this.prisma.payment_Transaction.findMany({
                where: {
                    status: PaymentStatus.PENDING,
                    created_at: {
                        lt: twentyFourHoursAgo,
                    },
                },
                include: {
                    donation: true,
                },
            })

            this.logger.log(
                `Found ${expiredPayments.length} expired pending payments`,
            )

            const payOS = this.getPayOS()
            let successCount = 0
            let failCount = 0

            for (const payment of expiredPayments) {
                try {
                    if (!payment.order_code) {
                        this.logger.warn(
                            `Payment ${payment.id} has no order_code, skipping`,
                        )
                        continue
                    }

                    // Cancel payment link in PayOS
                    await payOS.paymentRequests.cancel(
                        Number(payment.order_code),
                        "Payment expired after 24 hours",
                    )

                    // Update payment status to CANCELLED
                    await this.prisma.payment_Transaction.update({
                        where: { id: payment.id },
                        data: {
                            status: PaymentStatus.FAILED,
                            error_code: "EXPIRED",
                            error_description:
                                "Payment cancelled automatically after 24 hours",
                            updated_at: new Date(),
                        },
                    })

                    successCount++
                    this.logger.log(
                        `Cancelled payment ${payment.id} (order: ${payment.order_code})`,
                    )
                } catch (error) {
                    failCount++
                    this.logger.error(
                        `Failed to cancel payment ${payment.id} (order: ${payment.order_code})`,
                        error,
                    )
                }
            }

            this.logger.log(
                `Cleanup completed: ${successCount} cancelled, ${failCount} failed`,
            )
        } catch (error) {
            this.logger.error("Error during payment cleanup:", error)
        }
    }

    /**
     * Manual trigger for testing or admin use
     */
    async manualCleanup(): Promise<{
        success: boolean
        cancelled: number
        failed: number
    }> {
        this.logger.log("Manual cleanup triggered")

        const twentyFourHoursAgo = new Date()
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

        const expiredPayments = await this.prisma.payment_Transaction.findMany({
            where: {
                status: PaymentStatus.PENDING,
                created_at: {
                    lt: twentyFourHoursAgo,
                },
            },
        })

        const payOS = this.getPayOS()
        let successCount = 0
        let failCount = 0

        for (const payment of expiredPayments) {
            try {
                if (!payment.order_code) continue

                await payOS.paymentRequests.cancel(
                    Number(payment.order_code),
                    "Manual cleanup",
                )

                await this.prisma.payment_Transaction.update({
                    where: { id: payment.id },
                    data: {
                        status: PaymentStatus.FAILED,
                        error_code: "EXPIRED",
                        error_description: "Payment cancelled manually",
                        updated_at: new Date(),
                    },
                })

                successCount++
            } catch (error) {
                failCount++
                this.logger.error(
                    `Failed to cancel payment ${payment.id}`,
                    error,
                )
            }
        }

        return {
            success: true,
            cancelled: successCount,
            failed: failCount,
        }
    }
}
