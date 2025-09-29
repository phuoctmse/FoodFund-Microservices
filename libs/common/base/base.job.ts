import { SentryService } from "@libs/observability/sentry.service"
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common"

export interface JobExecutionResult {
    jobName: string
    totalProcessed: number
    successCount: number
    failureCount: number
    results: Array<{
        success: boolean
        campaignId?: string
        error?: string
        reason?: string
    }>
    executionTime: number
    timestamp: Date
}

export interface JobMetrics {
    startTime: number
    endTime?: number
    duration?: number
    memoryUsageBefore: number
    memoryUsageAfter?: number
}

@Injectable()
export abstract class BaseJobHandler implements OnModuleDestroy {
    protected readonly logger = new Logger(this.constructor.name)

    private readonly jobLocks = new Map<string, boolean>()
    private readonly activeJobs = new Set<Promise<any>>()
    private isShuttingDown = false

    constructor(protected readonly sentryService: SentryService) {}

    /**
     * Execute job with proper mutex and error handling
     */
    protected async executeJobSafely<T>(
        jobName: string,
        jobFunction: () => Promise<T>,
        options: {
            timeout?: number
            retryCount?: number
            context?: Record<string, any>
        } = {},
    ): Promise<T | null> {
        const { timeout = 300000, retryCount = 0, context = {} } = options
        const lockKey = `${jobName}_${this.constructor.name}`

        if (this.isShuttingDown) {
            this.logger.warn(`Skipping ${jobName} - service is shutting down`)
            return null
        }

        if (this.jobLocks.get(lockKey)) {
            return null
        }

        this.jobLocks.set(lockKey, true)
        const metrics = this.startJobMetrics()

        try {
            const jobPromise = this.executeWithTimeout(jobFunction(), timeout)
            this.activeJobs.add(jobPromise)

            this.logger.log(`Starting ${jobName}...`)

            const result = await jobPromise

            this.logJobSuccess(jobName, result, metrics, context)
            return result
        } catch (error) {
            await this.handleJobError(
                jobName,
                error,
                metrics,
                context,
                retryCount,
            )
            return null
        } finally {
            this.jobLocks.set(lockKey, false)
            this.endJobMetrics(metrics)

            for (const job of this.activeJobs) {
                if (await this.isPromiseSettled(job)) {
                    this.activeJobs.delete(job)
                }
            }
        }
    }

    /**
     * Graceful shutdown - wait for active jobs to complete
     */
    async onModuleDestroy(): Promise<void> {
        this.isShuttingDown = true
        this.logger.log("Gracefully shutting down job handler...")

        if (this.activeJobs.size > 0) {
            this.logger.log(
                `Waiting for ${this.activeJobs.size} active jobs to complete...`,
            )

            try {
                await Promise.race([
                    Promise.allSettled(Array.from(this.activeJobs)),
                    this.delay(30000),
                ])
            } catch (error) {
                this.logger.error("Error during graceful shutdown:", error)
            }
        }

        this.logger.log("Job handler shutdown complete")
    }

    /**
     * Execute function with timeout
     */
    private async executeWithTimeout<T>(
        promise: Promise<T>,
        timeout: number,
    ): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Job timeout after ${timeout}ms`)),
                    timeout,
                ),
            ),
        ])
    }

    /**
     * Check if promise is settled
     */
    private async isPromiseSettled(promise: Promise<any>): Promise<boolean> {
        try {
            await Promise.race([
                promise,
                new Promise((resolve) => setImmediate(resolve)),
            ])
            return true
        } catch {
            return true
        }
    }

    /**
     * Start job metrics collection
     */
    private startJobMetrics(): JobMetrics {
        return {
            startTime: Date.now(),
            memoryUsageBefore: process.memoryUsage().heapUsed,
        }
    }

    /**
     * End job metrics collection
     */
    private endJobMetrics(metrics: JobMetrics): void {
        metrics.endTime = Date.now()
        metrics.duration = metrics.endTime - metrics.startTime
        metrics.memoryUsageAfter = process.memoryUsage().heapUsed
    }

    /**
     * Log successful job execution
     */
    private logJobSuccess(
        jobName: string,
        result: any,
        metrics: JobMetrics,
        context: Record<string, any>,
    ): void {
        const memoryUsed =
            ((metrics.memoryUsageAfter || 0) - metrics.memoryUsageBefore) /
            1024 /
            1024

        if (this.isJobExecutionResult(result)) {
            this.logger.log(
                `${jobName} completed: ${result.successCount}/${result.totalProcessed} ` +
                    `campaigns processed in ${metrics.duration}ms ` +
                    `(Memory: ${memoryUsed.toFixed(2)}MB)`,
            )

            if (result.failureCount > 0) {
                this.handleJobFailures(jobName, result, context)
            }
        } else {
            this.logger.log(
                `${jobName} completed successfully in ${metrics.duration}ms`,
            )
        }
    }

    /**
     * Handle job errors with retry logic
     */
    private async handleJobError(
        jobName: string,
        error: any,
        metrics: JobMetrics,
        context: Record<string, any>,
        retryCount: number,
    ): Promise<void> {
        const errorMessage = error?.message || "Unknown error"

        this.logger.error(
            `${jobName} failed after ${metrics.duration || "unknown"}ms: ${errorMessage}`,
            error.stack,
        )

        this.sentryService.captureError(error as Error, {
            operation: this.convertJobNameToOperation(jobName),
            context: "cron-job-failure",
            metrics: {
                duration: metrics.duration,
                memoryUsed:
                    ((metrics.memoryUsageAfter || 0) -
                        metrics.memoryUsageBefore) /
                    1024 /
                    1024,
            },
            retryCount,
            ...context,
        })

        if (retryCount > 0) {
            this.logger.log(
                `Retrying ${jobName} in 5 seconds... (${retryCount} retries left)`,
            )
            await this.delay(5000)
        }
    }

    /**
     * Handle job failures with structured reporting
     */
    private handleJobFailures(
        jobName: string,
        result: JobExecutionResult,
        context: Record<string, any>,
    ): void {
        const failures = result.results.filter((r) => !r.success)

        this.logger.error(
            `${jobName} had ${result.failureCount} failures:`,
            failures.slice(0, 5),
        )

        this.sentryService.captureError(
            new Error(`${jobName} had ${result.failureCount} failures`),
            {
                operation: this.convertJobNameToOperation(jobName),
                jobResult: {
                    totalProcessed: result.totalProcessed,
                    successCount: result.successCount,
                    failureCount: result.failureCount,
                    executionTime: result.executionTime,
                },
                failures: failures.slice(0, 10),
                ...context,
            },
        )
    }

    /**
     * Type guard for JobExecutionResult
     */
    private isJobExecutionResult(result: any): result is JobExecutionResult {
        return (
            result &&
            typeof result === "object" &&
            "totalProcessed" in result &&
            "successCount" in result &&
            "failureCount" in result
        )
    }

    /**
     * Convert job name to operation name
     */
    private convertJobNameToOperation(jobName: string): string {
        return jobName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
    }

    /**
     * Utility delay function
     */
    protected delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
