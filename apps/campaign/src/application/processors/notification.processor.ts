import { BullDatadogService, QUEUE_NAMES } from "@libs/queue"
import {
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
    Process,
    Processor,
} from "@nestjs/bull"
import { NotificationService } from "../services/notification"
import {
    GroupedNotificationJob,
    NotificationJob,
} from "../../domain/interfaces/notification"
import { Job } from "bull"
import { Logger } from "@nestjs/common"

@Processor(QUEUE_NAMES.CAMPAIGN_JOBS)
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name)

    constructor(
        private readonly notificationService: NotificationService,
        private readonly datadogService: BullDatadogService,
    ) {}

    /**
     * Process single notification job
     */
    @Process("process-notification")
    async processNotification(job: Job<NotificationJob>): Promise<void> {
        const startTime = Date.now()

        try {
            await this.notificationService.createNotification({
                userId: job.data.userId,
                type: job.data.type,
                data: job.data.data as any,
                priority: job.data.priority,
                actorId: job.data.actorId,
                entityId: job.data.entityId,
                eventId: job.data.eventId,
                metadata: {
                    queueJobId: job.id?.toString(),
                    processedAt: new Date().toISOString(),
                },
            })

            const duration = Date.now() - startTime
            this.datadogService.trackJobComplete(
                QUEUE_NAMES.CAMPAIGN_JOBS,
                job.id?.toString() || "",
                duration,
            )

            this.logger.log(
                `Notification job ${job.id} completed in ${duration}ms`,
            )
        } catch (error) {
            this.logger.error(
                `Failed to process notification job ${job.id}`,
                error,
            )
            throw error
        }
    }

    /**
     * Process grouped notification job (for batching)
     */
    @Process("process-grouped-notification")
    async processGroupedNotification(
        job: Job<GroupedNotificationJob>,
    ): Promise<void> {
        const startTime = Date.now()

        this.logger.log(
            `Processing grouped notification job: ${job.id} for ${job.data.userIds.length} users`,
        )

        try {
            const notificationInputs = job.data.userIds.map((userId) => ({
                userId,
                type: job.data.type,
                data: job.data.data as any,
                priority: job.data.priority,
                actorId: job.data.actorId,
                entityId: job.data.entityId,
                eventId: job.data.eventIds[0],
                metadata: {
                    queueJobId: job.id?.toString(),
                    processedAt: new Date().toISOString(),
                    isGrouped: true,
                },
            }))

            await this.notificationService.createBulkNotifications(
                notificationInputs as any,
            )

            const duration = Date.now() - startTime
            this.datadogService.trackJobComplete(
                QUEUE_NAMES.CAMPAIGN_JOBS,
                job.id?.toString() || "",
                duration,
            )

            this.logger.log(
                `Grouped notification job ${job.id} completed in ${duration}ms`,
            )
        } catch (error) {
            this.logger.error(
                `Failed to process grouped notification job ${job.id}`,
                error,
            )
            throw error
        }
    }

    /**
     * Track when job becomes active
     */
    @OnQueueActive()
    onActive(job: Job<NotificationJob | GroupedNotificationJob>) {
        this.datadogService.trackJobStart(
            QUEUE_NAMES.CAMPAIGN_JOBS,
            job.id?.toString() || "",
        )
    }

    /**
     * Track successful job completion
     */
    @OnQueueCompleted()
    onCompleted(job: Job<NotificationJob | GroupedNotificationJob>) {
        this.logger.log(`Notification job ${job.id} completed successfully`)
    }

    /**
     * Track failed jobs
     */
    @OnQueueFailed()
    onFailed(
        job: Job<NotificationJob | GroupedNotificationJob>,
        error: Error,
    ) {
        this.datadogService.trackJobFailed(
            QUEUE_NAMES.CAMPAIGN_JOBS,
            job.id?.toString() || "",
            error,
        )

        this.logger.error(
            `Notification job ${job.id} failed after ${job.attemptsMade} attempts`,
            {
                error: error.message,
                stack: error.stack,
                jobData: job.data,
            },
        )
    }
}