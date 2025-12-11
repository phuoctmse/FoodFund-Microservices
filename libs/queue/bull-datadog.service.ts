import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bull"
import { Queue } from "bull"
import { Cron, CronExpression } from "@nestjs/schedule"
import { StatsD } from "hot-shots"
import { envConfig } from "@libs/env"
import { QUEUE_NAMES } from "./constants"

@Injectable()
export class BullDatadogService implements OnModuleInit {
    private readonly logger = new Logger(BullDatadogService.name)
    private statsd: InstanceType<typeof StatsD>
    private readonly env = envConfig()
    private lastErrorLog = 0
    private lastWarningLog: Record<string, number> = {}

    constructor(
        @InjectQueue(QUEUE_NAMES.POST_LIKES) private readonly postLikeQueue: Queue,
        @InjectQueue(QUEUE_NAMES.CAMPAIGN_JOBS)
        private readonly campaignJobsQueue: Queue,
    ) { }

    async onModuleInit() {
        this.statsd = new StatsD({
            host: this.env.datadog.agentHost || "localhost",
            port: this.env.datadog.agentPort || 8125,
            prefix: "campaign.",
            globalTags: {
                env: this.env.datadog.env || "production",
                service: "campaign-service",
            },
        })

        this.logger.log("Bull Datadog monitoring initialized")

        // Log failed jobs details on startup
        await this.logFailedJobsDetails()
    }

    private async logFailedJobsDetails() {
        try {
            const failedJobs = await this.campaignJobsQueue.getFailed(0, 20)
            if (failedJobs.length > 0) {
                this.logger.warn(`Found ${failedJobs.length} failed jobs in campaign-jobs queue:`)
                for (const job of failedJobs) {
                    this.logger.warn(`  - Job ID: ${job.id}, Name: ${job.name}, Failed Reason: ${job.failedReason}`)
                    this.logger.warn(`    Data: ${JSON.stringify(job.data).substring(0, 200)}`)
                }
            }
        } catch (error) {
            this.logger.error("Failed to get failed jobs details", error)
        }
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async collectMetrics() {
        // Skip metrics in development
        if (this.env.nodeEnv === "development") {
            return
        }

        try {
            await this.collectQueueMetrics("post-likes", this.postLikeQueue)
            await this.collectQueueMetrics(
                "campaign-jobs",
                this.campaignJobsQueue,
            )
        } catch (error) {
            const errorMessage = error?.message || String(error)
            const errorName = error?.name || ""

            if (
                errorMessage.includes("Connection is closed") ||
                errorName === "MaxRetriesPerRequestError"
            ) {
                if (
                    !this.lastErrorLog ||
                    Date.now() - this.lastErrorLog > 60000
                ) {
                    this.logger.warn(
                        "Valkey unavailable - skipping metrics collection",
                    )
                    this.lastErrorLog = Date.now()
                }
            }
        }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async cleanFailedJobs() {
        if (this.env.nodeEnv === "development") {
            return
        }

        try {
            const postLikeCleaned = await this.postLikeQueue.clean(3600000, "failed")
            const campaignJobsCleaned = await this.campaignJobsQueue.clean(3600000, "failed")

            const totalCleaned = postLikeCleaned.length + campaignJobsCleaned.length
            if (totalCleaned > 0) {
                this.logger.log(`Auto-cleaned ${totalCleaned} failed jobs (post-likes: ${postLikeCleaned.length}, campaign-jobs: ${campaignJobsCleaned.length})`)
            }
        } catch (error) {
            this.logger.error("Failed to auto-clean failed jobs", error)
        }
    }

    private async collectQueueMetrics(queueName: string, queue: Queue) {
        try {
            const [waiting, active, completed, failed, delayed] =
                await Promise.all([
                    queue.getWaitingCount(),
                    queue.getActiveCount(),
                    queue.getCompletedCount(),
                    queue.getFailedCount(),
                    queue.getDelayedCount(),
                ])

            this.statsd.gauge(`queue.${queueName}.waiting`, waiting)
            this.statsd.gauge(`queue.${queueName}.active`, active)
            this.statsd.gauge(`queue.${queueName}.completed`, completed)
            this.statsd.gauge(`queue.${queueName}.failed`, failed)
            this.statsd.gauge(`queue.${queueName}.delayed`, delayed)

            const healthScore = this.calculateHealthScore(
                waiting,
                active,
                failed,
            )
            this.statsd.gauge(`queue.${queueName}.health_score`, healthScore)

            if (waiting > 100 || failed > 10 || healthScore < 70) {
                // Throttle warning logs to once per minute per queue
                const now = Date.now()
                if (!this.lastWarningLog[queueName] || now - this.lastWarningLog[queueName] > 60000) {
                    this.logger.warn(`Queue ${queueName} needs attention`, {
                        waiting,
                        active,
                        failed,
                        healthScore,
                    })
                    this.lastWarningLog[queueName] = now
                }
            }
        } catch (error) {
            const errorMessage = error?.message || String(error)
            if (
                !errorMessage.includes("Connection is closed") &&
                !errorMessage.includes("MaxRetriesPerRequestError")
            ) {
                this.logger.error(
                    `Failed to collect metrics for ${queueName}`,
                    error,
                )
            }
            throw error
        }
    }

    private calculateHealthScore(
        waiting: number,
        active: number,
        failed: number,
    ): number {
        let score = 100
        if (waiting > 100) score -= 20
        if (waiting > 500) score -= 30
        if (waiting > 1000) score -= 50
        if (failed > 10) score -= 10
        if (failed > 50) score -= 20
        if (failed > 100) score -= 40
        if (active === 0 && waiting > 0) score -= 30
        return Math.max(0, score)
    }

    trackJobStart(queueName: string, jobId: string) {
        this.statsd.increment(`queue.${queueName}.job.started`, {
            job_id: jobId,
        })
    }

    trackJobComplete(queueName: string, jobId: string, duration: number) {
        this.statsd.increment(`queue.${queueName}.job.completed`, {
            job_id: jobId,
        })
        this.statsd.timing(`queue.${queueName}.job.duration`, duration, {
            job_id: jobId,
        })
    }

    trackJobFailed(queueName: string, jobId: string, error: Error) {
        this.statsd.increment(`queue.${queueName}.job.failed`, {
            job_id: jobId,
            error_type: error.name,
        })
    }
}
