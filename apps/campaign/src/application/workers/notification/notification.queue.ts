import { NotificationPriority } from "@app/campaign/src/domain/enums/notification"
import { GroupedNotificationJob, NotificationJob } from "@app/campaign/src/domain/interfaces/notification"
import { QUEUE_NAMES } from "@libs/queue"
import { InjectQueue } from "@nestjs/bull"
import { Injectable } from "@nestjs/common"
import { JobOptions, Queue } from "bull"

@Injectable()
export class NotificationQueue {
    constructor(
        @InjectQueue(QUEUE_NAMES.CAMPAIGN_JOBS)
        private readonly notificationQueue: Queue,
    ) {}

    async addNotificationJob(
        job: NotificationJob,
        options?: JobOptions,
    ): Promise<void> {
        const jobOptions: JobOptions = {
            jobId: job.eventId,
            priority: this.getPriorityValue(job.priority),
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000,
            },
            ...options,
        }

        if (job.delaySeconds && job.delaySeconds > 0) {
            jobOptions.delay = job.delaySeconds * 1000
        }

        await this.notificationQueue.add(
            "process-notification",
            job,
            jobOptions,
        )
    }

    async addGroupedNotificationJob(
        job: GroupedNotificationJob,
        options?: JobOptions,
    ): Promise<void> {
        const jobId = `grouped-${job.entityId}-${Date.now()}`
        const jobOptions: JobOptions = {
            jobId,
            priority: this.getPriorityValue(job.priority),
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000,
            },
            ...options,
        }

        await this.notificationQueue.add(
            "process-grouped-notification",
            job,
            jobOptions,
        )
    }

    private getPriorityValue(priority: NotificationPriority): number {
        const priorityMap = {
            [NotificationPriority.HIGH]: 1,
            [NotificationPriority.MEDIUM]: 5,
            [NotificationPriority.LOW]: 10,
        }
        return priorityMap[priority]
    }

    async getQueueMetrics() {
        return {
            waiting: await this.notificationQueue.getWaitingCount(),
            active: await this.notificationQueue.getActiveCount(),
            completed: await this.notificationQueue.getCompletedCount(),
            failed: await this.notificationQueue.getFailedCount(),
            delayed: await this.notificationQueue.getDelayedCount(),
        }
    }
}