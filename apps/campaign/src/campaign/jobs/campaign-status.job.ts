import { Injectable, Logger } from "@nestjs/common"
import { CampaignSchedulerService } from "../services/campaign-scheduler.service"
import { SentryService } from "@libs/observability/sentry.service"
import { Cron } from "@nestjs/schedule"

@Injectable()
export class CampaignStatusJob {
    private readonly logger = new Logger(CampaignStatusJob.name)
    private isActivationJobRunning = false
    private isCompletionJobRunning = false
    private isExpirationJobRunning = false

    constructor(
        private readonly campaignSchedulerService: CampaignSchedulerService,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Run at 00:00 (midnight) every day
     * Activates approved campaigns that have reached their start date
     */
    @Cron("0 0 * * *", {
        name: "activate-approved-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleActivateApprovedCampaigns(): Promise<void> {
        if (this.isActivationJobRunning) {
            return
        }

        this.isActivationJobRunning = true

        try {
            const result =
                await this.campaignSchedulerService.activateApprovedCampaigns()

            this.logger.log(
                `Activation job completed successfully: ${result.successCount}/${result.totalProcessed} campaigns processed`,
            )

            if (result.failureCount > 0) {
                const failures = result.results.filter((r) => !r.success)

                this.sentryService.captureError(
                    new Error(
                        `Campaign activation job had ${result.failureCount} failures`,
                    ),
                    {
                        operation: "scheduledCampaignActivation",
                        jobResult: result,
                        failures: failures.slice(0, 10),
                    },
                )
            }
        } catch (error) {
            this.logger.error("Activation job failed completely:", error)
            this.sentryService.captureError(error as Error, {
                operation: "scheduledCampaignActivation",
                context: "cron-job-failure",
            })
        } finally {
            this.isActivationJobRunning = false
        }
    }

    /**
     * Run at 00:00 (midnight) every day
     * Completes active campaigns that have reached end date or target amount
     */
    @Cron("0 0 * * *", {
        name: "complete-active-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleCompleteActiveCampaigns(): Promise<void> {
        if (this.isCompletionJobRunning) {
            return
        }

        this.isCompletionJobRunning = true

        try {
            const result =
                await this.campaignSchedulerService.completeActiveCampaigns()

            this.logger.log(
                `Completion job completed successfully: ${result.successCount}/${result.totalProcessed} campaigns processed`,
            )

            if (result.failureCount > 0) {
                const failures = result.results.filter((r) => !r.success)
                this.logger.error(
                    `Completion job had ${result.failureCount} failures:`,
                    failures,
                )

                this.sentryService.captureError(
                    new Error(
                        `Campaign completion job had ${result.failureCount} failures`,
                    ),
                    {
                        operation: "scheduledCampaignCompletion",
                        jobResult: result,
                        failures: failures.slice(0, 10),
                    },
                )
            }
        } catch (error) {
            this.logger.error("Completion job failed completely:", error)
            this.sentryService.captureError(error as Error, {
                operation: "scheduledCampaignCompletion",
                context: "cron-job-failure",
            })
        } finally {
            this.isCompletionJobRunning = false
        }
    }

    /**
     * Run at 00:00 (midnight) every day
     * Handles expired campaigns (PENDING -> REJECTED, APPROVED -> CANCELLED)
     */
    @Cron("0 0 * * *", {
        name: "handle-expired-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleExpiredCampaigns(): Promise<void> {
        if (this.isExpirationJobRunning) {
            return
        }

        this.isExpirationJobRunning = true

        try {
            const result =
                await this.campaignSchedulerService.handleExpiredCampaigns()

            this.logger.log(
                `Expiration job completed successfully: ${result.successCount}/${result.totalProcessed} campaigns processed`,
            )

            if (result.failureCount > 0) {
                const failures = result.results.filter((r) => !r.success)
                this.logger.error(
                    `Expiration job had ${result.failureCount} failures:`,
                    failures,
                )

                this.sentryService.captureError(
                    new Error(
                        `Campaign expiration job had ${result.failureCount} failures`,
                    ),
                    {
                        operation: "scheduledCampaignExpiration",
                        jobResult: result,
                        failures: failures.slice(0, 10),
                    },
                )
            }
        } catch (error) {
            this.logger.error("Expiration job failed completely:", error)
            this.sentryService.captureError(error as Error, {
                operation: "scheduledCampaignExpiration",
                context: "cron-job-failure",
            })
        } finally {
            this.isExpirationJobRunning = false
        }
    }

    async runAllJobs(): Promise<{
        activation: any
        completion: any
        expiration: any
    }> {
        try {
            const [activation, completion, expiration] =
                await Promise.allSettled([
                    this.campaignSchedulerService.activateApprovedCampaigns(),
                    this.campaignSchedulerService.completeActiveCampaigns(),
                    this.campaignSchedulerService.handleExpiredCampaigns(),
                ])

            return {
                activation:
                    activation.status === "fulfilled"
                        ? activation.value
                        : { error: activation.reason },
                completion:
                    completion.status === "fulfilled"
                        ? completion.value
                        : { error: completion.reason },
                expiration:
                    expiration.status === "fulfilled"
                        ? expiration.value
                        : { error: expiration.reason },
            }
        } catch (error) {
            this.logger.error("Manual job execution failed:", error)
            this.sentryService.captureError(error as Error, {
                operation: "manualCampaignJobExecution",
            })
            throw error
        }
    }
}
