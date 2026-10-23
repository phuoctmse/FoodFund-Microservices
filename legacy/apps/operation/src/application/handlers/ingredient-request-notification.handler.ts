import { OnEvent } from "@nestjs/event-emitter"
import {
    IngredientRequestApprovedEvent,
    IngredientRequestRejectedEvent,
} from "../../domain/events/ingredient-request.event"
import { NotificationType } from "../../shared/enums"
import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class IngredientRequestNotificationHandler {
    private readonly logger = new Logger(
        IngredientRequestNotificationHandler.name,
    )

    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    @OnEvent("ingredient-request.approved")
    async handleIngredientRequestApproved(
        event: IngredientRequestApprovedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                ingredientRequestId: event.ingredientRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                itemCount: event.itemCount,
                approvedAt: event.approvedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.INGREDIENT_REQUEST_APPROVED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling ingredient request approved event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "IngredientRequestNotificationHandler.handleIngredientRequestApproved",
                ingredientRequestId: event.ingredientRequestId,
                fundraiserId: event.fundraiserId,
                organizationId: event.organizationId,
            })
        }
    }

    @OnEvent("ingredient-request.rejected")
    async handleIngredientRequestRejected(
        event: IngredientRequestRejectedEvent,
    ): Promise<void> {
        try {
            const recipientCognitoIds = await this.getRecipientCognitoIds(
                event.fundraiserId,
                event.organizationId,
            )

            const notificationData = {
                ingredientRequestId: event.ingredientRequestId,
                campaignId: event.campaignId,
                campaignPhaseId: event.campaignPhaseId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                totalCost: event.totalCost,
                itemCount: event.itemCount,
                adminNote: event.adminNote,
                rejectedAt: event.rejectedAt,
            }

            await this.sendNotificationsToRecipients(
                recipientCognitoIds,
                NotificationType.INGREDIENT_REQUEST_REJECTED,
                notificationData,
            )
        } catch (error) {
            this.logger.error(
                `Error handling ingredient request rejected event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "IngredientRequestNotificationHandler.handleIngredientRequestRejected",
                ingredientRequestId: event.ingredientRequestId,
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

        return recipientCognitoIds
    }

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
            this.sentryService.captureError(result.reason as Error, {
                operation: "sendNotificationToUser",
                cognitoId,
                notificationType,
            })
        })
    }

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
