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
import { NotificationBuilderFactory } from "../builders/notification"

@Processor(QUEUE_NAMES.CAMPAIGN_JOBS)
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name)

    constructor(
        private readonly notificationService: NotificationService,
        private readonly datadogService: BullDatadogService,
        private readonly notificationBuilder: NotificationBuilderFactory,
    ) {}

    /**
     * Process single notification job
     */
    @Process("send-notification")
    async processNotification(job: Job<NotificationJob>): Promise<void> {
        const startTime = Date.now()

        try {
            const notificationInput = {
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
            }

            await this.notificationService.createNotification(
                notificationInput as any,
            )

            const duration = Date.now() - startTime
            this.datadogService.trackJobComplete(
                QUEUE_NAMES.CAMPAIGN_JOBS,
                job.id?.toString() || "",
                duration,
            )
        } catch (error) {
            if (
                error.name === "DuplicateEventError" &&
                error.action === "UPDATE_EXISTING"
            ) {
                this.logger.log(
                    `Notification job ${job.id} - Updating existing like notification`,
                )
            } else {
                this.logger.error(
                    `Failed to process notification job ${job.id}`,
                    error,
                )
                throw error
            }
        }
    }

    /**
     * Process grouped notification job (for batching)
     */
    @Process("send-grouped-notification")
    async processGroupedNotification(
        job: Job<GroupedNotificationJob>,
    ): Promise<void> {
        const startTime = Date.now()

        try {
            const { userIds, eventIds, ...jobData } = job.data

            const content = this.notificationBuilder.build({
                type: jobData.type,
                data: jobData.data as any,
                userId: userIds[0],
                actorId: jobData.actorId,
                entityId: jobData.entityId,
                metadata: {
                    queueJobId: `grouped-${jobData.entityId}-${Date.now()}`,
                    processedAt: new Date().toISOString(),
                    isGrouped: true,
                },
            })

            await Promise.all(
                userIds.map((userId) => {
                    const notificationData = {
                        ...jobData.data,
                        ...content.metadata,
                        title: content.title,
                        message: content.message,
                        queueJobId: `grouped-${jobData.entityId}-${Date.now()}`,
                        processedAt: new Date().toISOString(),
                        isGrouped: true,
                    }

                    return this.notificationService.createNotification({
                        userId,
                        type: jobData.type,
                        data: notificationData,
                        priority: jobData.priority,
                        actorId: jobData.actorId,
                        entityId: jobData.entityId,
                        eventId: eventIds?.[0],
                        metadata: {
                            queueJobId: `grouped-${jobData.entityId}-${Date.now()}`,
                            processedAt: new Date().toISOString(),
                            isGrouped: true,
                        },
                    } as any)
                }),
            )

            const duration = Date.now() - startTime
            this.datadogService.trackJobComplete(
                QUEUE_NAMES.CAMPAIGN_JOBS,
                job.id?.toString() || "",
                duration,
            )
        } catch (error) {
            this.logger.error(
                `Failed to process grouped notification job ${job.id}:`,
                error,
            )
            this.logger.error(`Job data: ${JSON.stringify(job.data)}`)
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
    onFailed(job: Job<NotificationJob | GroupedNotificationJob>, error: Error) {
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
