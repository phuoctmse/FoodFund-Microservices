import { OnEvent } from "@nestjs/event-emitter"
import { DeliveryTaskAssignedEvent } from "../../domain/events"
import { NotificationType } from "../../shared/enums"
import { SentryService } from "@libs/observability"
import { GrpcClientService } from "@libs/grpc"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class DeliveryTaskNotificationHandler {
    private readonly logger = new Logger(
        DeliveryTaskNotificationHandler.name,
    )

    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    @OnEvent("delivery-task.assigned")
    async handleDeliveryTaskAssigned(
        event: DeliveryTaskAssignedEvent,
    ): Promise<void> {
        try {
            const notificationData = {
                taskId: event.taskId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                foodName: event.foodName,
                quantity: event.quantity,
                location: event.location,
                fundraiserName: event.fundraiserName,
                organizationName: event.organizationName,
            }

            await this.sendNotificationToUser(
                event.deliveryStaffId,
                NotificationType.DELIVERY_TASK_ASSIGNED,
                notificationData,
                event.taskId,
            )
        } catch (error) {
            this.logger.error(
                `[DeliveryTaskAssigned] ❌ Error handling delivery task assigned event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "DeliveryTaskNotificationHandler.handleDeliveryTaskAssigned",
                taskId: event.taskId,
                deliveryStaffId: event.deliveryStaffId,
            })
        }
    }

    private async sendNotificationToUser(
        cognitoId: string,
        notificationType: NotificationType,
        notificationData: Record<string, any>,
        entityId?: string,
    ): Promise<void> {
        try {
            const response = await this.grpcClient.callCampaignService<
                {
                    userId: string
                    notificationType: string
                    dataJson: string
                },
                {
                    success: boolean
                    notificationId?: string
                    error?: string
                }
            >(
                "SendNotification",
                {
                    userId: cognitoId,
                    notificationType,
                    dataJson: JSON.stringify(notificationData),
                },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                this.logger.warn(
                    `[SendNotification] Failed for user ${cognitoId}: ${response.error}`,
                )
            }
        } catch (error) {
            this.logger.error(
                `[SendNotification] Error sending notification to ${cognitoId}:`,
                error.message,
            )
            throw error
        }
    }
}