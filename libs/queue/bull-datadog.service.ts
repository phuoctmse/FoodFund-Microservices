import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bull"
import { Queue } from "bull"
import { Cron, CronExpression } from "@nestjs/schedule"
import { StatsD } from "hot-shots"
import { QUEUE_NAMES } from "./constants"
import { envConfig } from "@libs/env"

@Injectable()
export class BullDatadogService implements OnModuleInit {
    private readonly logger = new Logger(BullDatadogService.name)
    private statsd: InstanceType<typeof StatsD>

    constructor(
        @InjectQueue(QUEUE_NAMES.POST_LIKES) private postLikeQueue: Queue,
        @InjectQueue(QUEUE_NAMES.DONATIONS) private donationQueue: Queue,
    ) {}

    onModuleInit() {
        const env = envConfig()
        this.statsd = new StatsD({
            host: env.datadog.agentHost || "localhost",
            port: env.datadog.agentPort || 8125,
            prefix: "campaign.",
            globalTags: {
                env: env.datadog.env || "production",
                service: "campaign-service",
            },
        })

        this.logger.log("Bull Datadog monitoring initialized")
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async collectMetrics() {
        await this.collectQueueMetrics("post-likes", this.postLikeQueue)
        await this.collectQueueMetrics("donations", this.donationQueue)
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

            // Only log if there are issues
            if (waiting > 100 || failed > 10 || healthScore < 70) {
                this.logger.warn(`Queue ${queueName} needs attention`, {
                    waiting,
                    active,
                    failed,
                    healthScore,
                })
            }
        } catch (error) {
            this.logger.error(
                `Failed to collect metrics for ${queueName}`,
                error,
            )
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
        this.statsd.increment(`queue.${queueName}.job.started`)
    }

    trackJobComplete(queueName: string, jobId: string, duration: number) {
        this.statsd.increment(`queue.${queueName}.job.completed`)
        this.statsd.timing(`queue.${queueName}.job.duration`, duration)
    }

    trackJobFailed(queueName: string, jobId: string, error: Error) {
        this.statsd.increment(`queue.${queueName}.job.failed`, {
            error_type: error.name,
        })
    }
}
