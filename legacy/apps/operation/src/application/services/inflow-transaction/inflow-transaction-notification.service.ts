import { NotificationType } from "@app/operation/src/shared/enums"
import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { Injectable } from "@nestjs/common"

export interface DisbursementNotificationData {
    campaignId: string
    campaignTitle: string
    phaseName: string
    disbursementType: RequestExpenseType
    amount: string
    fundraiserId: string
    organizationId?: string
}

type RequestExpenseType = "INGREDIENT" | "COOKING" | "DELIVERY"

@Injectable()
export class InflowTransactionNotificationService {
    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    /**
     * Send disbursement completion notifications to fundraiser and organization members
     */
    async sendDisbursementNotifications(
        data: DisbursementNotificationData,
    ): Promise<void> {
        try {
            const notificationTypeMap: Record<RequestExpenseType, NotificationType> = {
                INGREDIENT: NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED,
                COOKING: NotificationType.COOKING_DISBURSEMENT_COMPLETED,
                DELIVERY: NotificationType.DELIVERY_DISBURSEMENT_COMPLETED,
            }

            const notificationType = notificationTypeMap[data.disbursementType]

            const notificationData = {
                campaignId: data.campaignId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                disbursementType: data.disbursementType,
                amount: data.amount,
                disbursedAt: new Date().toISOString(),
            }

            // 1. Send to fundraiser
            await this.sendNotificationToUser(
                data.fundraiserId,
                notificationType,
                notificationData,
            )

            // 2. Send to organization members (if organization exists)
            if (data.organizationId) {
                await this.sendNotificationToOrganizationMembers(
                    data.organizationId,
                    notificationType,
                    notificationData,
                    data.fundraiserId,
                )
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "sendDisbursementNotifications",
                data,
            })
        }
    }

    /**
     * Send notification to a specific user
     */
    private async sendNotificationToUser(
        userId: string,
        notificationType: NotificationType,
        data: Record<string, any>,
    ): Promise<void> {
        await this.grpcClient.callCampaignService<
            {
                userId: string
                notificationType: string
                dataJson: string
            },
            { success: boolean; error?: string }
        >("SendNotification", {
            userId,
            notificationType,
            dataJson: JSON.stringify(data),
        })
    }

    /**
     * Send notification to all organization members
     */
    private async sendNotificationToOrganizationMembers(
        organizationId: string,
        notificationType: NotificationType,
        data: Record<string, any>,
        excludeUserId?: string,
    ): Promise<void> {
        try {
            const response = await this.grpcClient.callUserService<
                { organizationId: string },
                {
                    success: boolean
                    members?: Array<{
                        id: string
                        cognitoId: string
                        fullName: string
                        email: string
                    }>
                    error?: string
                }
            >("GetOrganizationMembers", { organizationId })

            if (!response.success || !response.members) {
                throw new Error(
                    response.error || "Failed to get organization members",
                )
            }

            const membersToNotify = response.members.filter(
                (member) => member.id !== excludeUserId,
            )

            if (membersToNotify.length === 0) {
                return
            }

            await Promise.all(
                membersToNotify.map((member) =>
                    this.sendNotificationToUser(
                        member.cognitoId,
                        notificationType,
                        data,
                    ),
                ),
            )
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "sendNotificationToOrganizationMembers",
                organizationId,
            })
        }
    }
}