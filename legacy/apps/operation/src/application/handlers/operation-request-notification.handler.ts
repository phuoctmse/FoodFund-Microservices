import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { Injectable, Logger } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import {
    CookingRequestApprovedEvent,
    CookingRequestRejectedEvent,
    DeliveryRequestApprovedEvent,
    DeliveryRequestRejectedEvent,
} from "../../domain/events"
import { NotificationType } from "../../shared/enums"

@Injectable()
export class OperationRequestNotificationHandler {
    private readonly logger = new Logger(
        OperationRequestNotificationHandler.name,
    )

    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    // ========== COOKING REQUEST HANDLERS ==========

    @OnEvent("operation-request.cooking.approved")
    async handleCookingRequestApproved(
        event: CookingRequestApprovedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                operationRequestId: event.operationRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                approvedAt: event.approvedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.COOKING_REQUEST_APPROVED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling cooking request approved event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "OperationRequestNotificationHandler.handleCookingRequestApproved",
                operationRequestId: event.operationRequestId,
                fundraiserId: event.fundraiserId,
                organizationId: event.organizationId,
            })
        }
    }

    @OnEvent("operation-request.cooking.rejected")
    async handleCookingRequestRejected(
        event: CookingRequestRejectedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                operationRequestId: event.operationRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                adminNote: event.adminNote,
                rejectedAt: event.rejectedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.COOKING_REQUEST_REJECTED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling cooking request rejected event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "OperationRequestNotificationHandler.handleCookingRequestRejected",
                operationRequestId: event.operationRequestId,
                fundraiserId: event.fundraiserId,
                organizationId: event.organizationId,
            })
        }
    }

    // ========== DELIVERY REQUEST HANDLERS ==========

    @OnEvent("operation-request.delivery.approved")
    async handleDeliveryRequestApproved(
        event: DeliveryRequestApprovedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                operationRequestId: event.operationRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                approvedAt: event.approvedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.DELIVERY_REQUEST_APPROVED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling delivery request approved event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "OperationRequestNotificationHandler.handleDeliveryRequestApproved",
                operationRequestId: event.operationRequestId,
                fundraiserId: event.fundraiserId,
                organizationId: event.organizationId,
            })
        }
    }

    @OnEvent("operation-request.delivery.rejected")
    async handleDeliveryRequestRejected(
        event: DeliveryRequestRejectedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                operationRequestId: event.operationRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                adminNote: event.adminNote,
                rejectedAt: event.rejectedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.DELIVERY_REQUEST_REJECTED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling delivery request rejected event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "OperationRequestNotificationHandler.handleDeliveryRequestRejected",
                operationRequestId: event.operationRequestId,
                fundraiserId: event.fundraiserId,
                organizationId: event.organizationId,
            })
        }
    }

    private async getRecipientCognitoIds(
        fundraiserId: string,
        organizationId: string | null,
    ): Promise<string[]> {
        if (!fundraiserId) {
            return []
        }

        const recipientCognitoIds: string[] = [fundraiserId]

        if (!organizationId) {
            return recipientCognitoIds
        }

        try {
            const orgMembersResponse = await this.grpcClient.callUserService<
                {
                    organizationId: string
                    status?: string
                },
                {
                    success: boolean
                    members?: Array<{
                        id: string
                        cognitoId: string
                        fullName: string
                        email: string
                        role: string
                        memberRole: string
                        status: string
                    }>
                    error?: string
                }
            >(
                "GetOrganizationMembers",
                {
                    organizationId,
                    status: "VERIFIED",
                },
                { timeout: 5000, retries: 2 },
            )

            if (!orgMembersResponse.success) {
                return recipientCognitoIds
            }

            if (
                !orgMembersResponse.members ||
                orgMembersResponse.members.length === 0
            ) {
                return recipientCognitoIds
            }

            orgMembersResponse.members.forEach((member) => {
                if (member.memberRole === "REPRESENTATIVE") {
                    return
                }

                const cognitoId = member.cognitoId

                if (!cognitoId) {
                    return
                }

                if (recipientCognitoIds.includes(cognitoId)) {
                    return
                }

                recipientCognitoIds.push(cognitoId)
            })
        } catch (error) {
            this.logger.error(
                `Error fetching organization members: ${error.message}`,
                error.stack,
            )
        }

        return recipientCognitoIds
    }

    /**
     * Send notifications to all recipients
     */
    private async sendNotificationsToRecipients(
        recipientCognitoIds: string[],
        notificationType: NotificationType,
        notificationData: Record<string, any>,
    ): Promise<void> {
        const validCognitoIds = recipientCognitoIds.filter((cognitoId) => {
            const isValid =
                cognitoId &&
                cognitoId !== "undefined" &&
                cognitoId !== "null" &&
                typeof cognitoId === "string" &&
                cognitoId.trim().length > 0

            if (isValid) {
                return true
            }
            return false
        })

        if (validCognitoIds.length === 0) {
            return
        }

        const notificationResults = await Promise.allSettled(
            validCognitoIds.map((cognitoId) =>
                this.sendNotificationToUser(
                    cognitoId,
                    notificationType,
                    notificationData,
                ),
            ),
        )

        notificationResults.forEach((result, index) => {
            const cognitoId = validCognitoIds[index]
            if (result.status === "fulfilled") {
                return
            }

            this.logger.error(
                `❌ Failed to send notification to ${cognitoId}: ${result.reason?.message}`,
            )
            this.sentryService.captureError(result.reason as Error, {
                operation: "sendNotificationToUser",
                cognitoId,
                notificationType,
            })
        })
    }

    /**
     * Send notification to a single user
     */
    private async sendNotificationToUser(
        cognitoId: string,
        notificationType: NotificationType,
        notificationData: Record<string, any>,
    ): Promise<void> {
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

        if (response.success) {
            return
        }

        throw new Error(
            `Failed to send ${notificationType} notification: ${response.error || "Unknown error"}`,
        )
    }
}
