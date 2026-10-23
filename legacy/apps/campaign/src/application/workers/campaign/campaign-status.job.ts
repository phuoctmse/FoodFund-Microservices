import { Injectable } from "@nestjs/common"
import { CampaignSchedulerService } from "./schedulers/campaign-scheduler.service"
import { SentryService } from "@libs/observability/sentry.service"
import { Cron, CronExpression } from "@nestjs/schedule"
import { BaseJobHandler, JobExecutionResult } from "@libs/common/base/base.job"

@Injectable()
export class CampaignStatusJob extends BaseJobHandler {
    constructor(
        private readonly campaignSchedulerService: CampaignSchedulerService,
        sentryService: SentryService,
    ) {
        super(sentryService)
    }

    /**
     * Activate approved campaigns that have reached their start date
     * Runs daily at midnight (Vietnam timezone)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        name: "activate-approved-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleActivateApprovedCampaigns(): Promise<void> {
        await this.executeJobSafely(
            "Campaign Activation",
            () => this.campaignSchedulerService.activateApprovedCampaigns(),
            {
                timeout: 300000, // 5 minutes
                context: { jobType: "activation", scheduled: true },
            },
        )
    }

    /**
     * Complete active campaigns that have reached end date or target amount
     * Runs daily at midnight (Vietnam timezone)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        name: "complete-active-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleCompleteActiveCampaigns(): Promise<void> {
        await this.executeJobSafely(
            "Campaign Completion",
            () => this.campaignSchedulerService.completeActiveCampaigns(),
            {
                timeout: 300000, // 5 minutes
                context: { jobType: "completion", scheduled: true },
            },
        )
    }

    /**
     * Handle expired campaigns (PENDING -> REJECTED, APPROVED -> CANCELLED)
     * Runs daily at midnight (Vietnam timezone)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        name: "handle-expired-campaigns",
        timeZone: "Asia/Ho_Chi_Minh",
    })
    async handleExpiredCampaigns(): Promise<void> {
        await this.executeJobSafely(
            "Campaign Expiration",
            () => this.campaignSchedulerService.handleExpiredCampaigns(),
            {
                timeout: 300000, // 5 minutes
                context: { jobType: "expiration", scheduled: true },
            },
        )
    }

    /**
     * Manual execution of all campaign jobs
     * Useful for testing and manual triggers
     * Returns structured results for monitoring
     */
    async runAllJobs(): Promise<CampaignJobsExecutionSummary> {
        const startTime = Date.now()

        try {
            const [activationResult, completionResult, expirationResult] =
                await Promise.allSettled([
                    this.executeJobSafely(
                        "Manual Campaign Activation",
                        () =>
                            this.campaignSchedulerService.activateApprovedCampaigns(),
                        { context: { manual: true, jobType: "activation" } },
                    ),
                    this.executeJobSafely(
                        "Manual Campaign Completion",
                        () =>
                            this.campaignSchedulerService.completeActiveCampaigns(),
                        { context: { manual: true, jobType: "completion" } },
                    ),
                    this.executeJobSafely(
                        "Manual Campaign Expiration",
                        () =>
                            this.campaignSchedulerService.handleExpiredCampaigns(),
                        { context: { manual: true, jobType: "expiration" } },
                    ),
                ])

            const executionTime = Date.now() - startTime
            const summary = this.buildExecutionSummary(
                activationResult,
                completionResult,
                expirationResult,
                executionTime,
            )

            this.logExecutionSummary(summary)
            return summary
        } catch (error) {
            this.logger.error("Manual job execution failed:", error)
            this.sentryService.captureError(error as Error, {
                operation: "manualCampaignJobExecution",
                context: "manual-execution",
            })
            throw error
        }
    }

    /**
     * Build execution summary from job results
     */
    private buildExecutionSummary(
        activationResult: PromiseSettledResult<JobExecutionResult | null>,
        completionResult: PromiseSettledResult<JobExecutionResult | null>,
        expirationResult: PromiseSettledResult<JobExecutionResult | null>,
        totalExecutionTime: number,
    ): CampaignJobsExecutionSummary {
        const results = {
            activation: this.extractJobResult(activationResult, "activation"),
            completion: this.extractJobResult(completionResult, "completion"),
            expiration: this.extractJobResult(expirationResult, "expiration"),
        }

        return {
            results,
            summary: {
                totalJobs: 3,
                successfulJobs: this.countSuccessfulJobs(results),
                failedJobs: this.countFailedJobs(results),
                totalCampaignsProcessed: this.countTotalCampaigns(results),
                totalSuccesses: this.countTotalSuccesses(results),
                totalFailures: this.countTotalFailures(results),
                executionTime: totalExecutionTime,
                timestamp: new Date(),
            },
        }
    }

    /**
     * Extract job result with proper error handling
     */
    private extractJobResult(
        settledResult: PromiseSettledResult<JobExecutionResult | null>,
        jobType: string,
    ): JobResultOrError {
        if (settledResult.status === "fulfilled" && settledResult.value) {
            return {
                type: "success",
                result: settledResult.value,
            }
        } else {
            const error =
                settledResult.status === "rejected"
                    ? settledResult.reason?.message || "Promise rejected"
                    : "Job returned null"

            return {
                type: "error",
                error,
                jobType,
            }
        }
    }

    /**
     * Count successful jobs
     */
    private countSuccessfulJobs(
        results: Record<string, JobResultOrError>,
    ): number {
        return Object.values(results).filter((r) => r.type === "success").length
    }

    /**
     * Count failed jobs
     */
    private countFailedJobs(results: Record<string, JobResultOrError>): number {
        return Object.values(results).filter((r) => r.type === "error").length
    }

    /**
     * Count total campaigns processed
     */
    private countTotalCampaigns(
        results: Record<string, JobResultOrError>,
    ): number {
        return Object.values(results).reduce((total, result) => {
            return (
                total +
                (result.type === "success" ? result.result.totalProcessed : 0)
            )
        }, 0)
    }

    /**
     * Count total successful operations
     */
    private countTotalSuccesses(
        results: Record<string, JobResultOrError>,
    ): number {
        return Object.values(results).reduce((total, result) => {
            return (
                total +
                (result.type === "success" ? result.result.successCount : 0)
            )
        }, 0)
    }

    /**
     * Count total failed operations
     */
    private countTotalFailures(
        results: Record<string, JobResultOrError>,
    ): number {
        return Object.values(results).reduce((total, result) => {
            return (
                total +
                (result.type === "success" ? result.result.failureCount : 0)
            )
        }, 0)
    }

    /**
     * Log execution summary with structured information
     */
    private logExecutionSummary(summary: CampaignJobsExecutionSummary): void {
        const { summary: s, results } = summary

        this.logger.log(
            `Manual job execution completed in ${s.executionTime}ms. ` +
                `Jobs: ${s.successfulJobs}/${s.totalJobs} successful, ` +
                `Campaigns: ${s.totalSuccesses}/${s.totalCampaignsProcessed} successful`,
        )

        // Log any job failures
        const failedJobs = Object.entries(results)
            .filter(([, result]) => result.type === "error")
            .map(([jobName, result]) => `${jobName}: ${(result as any).error}`)

        if (failedJobs.length > 0) {
            this.logger.error("Failed jobs:", failedJobs)
            this.sentryService.captureError(
                new Error(
                    `Manual execution had ${failedJobs.length} job failures`,
                ),
                {
                    operation: "manualCampaignJobExecution",
                    failedJobs,
                    summary: s,
                },
            )
        }
    }
}

/**
 * Type definitions for job execution results
 */
type JobResultOrError =
    | { type: "success"; result: JobExecutionResult }
    | { type: "error"; error: string; jobType: string }

interface CampaignJobsExecutionSummary {
    results: {
        activation: JobResultOrError
        completion: JobResultOrError
        expiration: JobResultOrError
    }
    summary: {
        totalJobs: number
        successfulJobs: number
        failedJobs: number
        totalCampaignsProcessed: number
        totalSuccesses: number
        totalFailures: number
        executionTime: number
        timestamp: Date
    }
}
