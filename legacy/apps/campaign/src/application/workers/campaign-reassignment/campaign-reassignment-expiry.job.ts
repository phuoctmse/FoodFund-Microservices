import { SentryService } from "@libs/observability"
import { Cron, CronExpression } from "@nestjs/schedule"
import { CampaignReassignmentService } from "../../services/campaign-reassignment"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class ReassignmentExpiryJob {
    private readonly logger = new Logger(ReassignmentExpiryJob.name)

    constructor(
        private readonly reassignmentService: CampaignReassignmentService,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Check for expired reassignment requests daily at 1 AM
     * Process refunds for campaigns where all assignments expired
     */
    @Cron(CronExpression.EVERY_DAY_AT_1AM, {
        name: "process-expired-reassignments",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleExpiredReassignments(): Promise<void> {
        this.logger.log("Starting expired reassignment processing job...")

        try {
            const result =
                await this.reassignmentService.processExpiredReassignments()

            this.logger.log(
                `Expired reassignment job completed: ${result.expiredCount} expired, ${result.refundedCampaigns.length} campaigns refunded`,
            )
        } catch (error) {
            this.logger.error("Failed to process expired reassignments:", error)
            this.sentryService.captureError(error as Error, {
                operation: "handleExpiredReassignments",
                context: "reassignment-expiry-job",
            })
        }
    }
}
