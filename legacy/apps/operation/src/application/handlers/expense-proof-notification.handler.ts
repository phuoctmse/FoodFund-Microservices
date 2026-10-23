import { Injectable, Logger } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import { ExpenseProofApprovedEvent, ExpenseProofRejectedEvent } from "../../domain/events"
import { GrpcClientService } from "@libs/grpc"
import { SentryService } from "@libs/observability"
import { NotificationType } from "../../shared/enums"

@Injectable()
export class ExpenseProofNotificationHandler {
    private readonly logger = new Logger(ExpenseProofNotificationHandler.name)

    constructor(
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
    ) {}

    @OnEvent("expense-proof.approved")
    async handleExpenseProofApproved(
        event: ExpenseProofApprovedEvent,
    ): Promise<void> {
        try {
            const notificationData = {
                expenseProofId: event.expenseProofId,
                requestId: event.requestId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                amount: event.amount,
                approvedAt: event.approvedAt,
            }

            const response = await this.grpcClient.callCampaignService<
                {
                    userId: string
                    notificationType: string
                    dataJson: string
                },
                { success: boolean; notificationId?: string; error?: string }
            >(
                "SendNotification",
                {
                    userId: event.kitchenStaffId,
                    notificationType: NotificationType.EXPENSE_PROOF_APPROVED,
                    dataJson: JSON.stringify(notificationData),
                },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                this.logger.error(
                    `Failed to send EXPENSE_PROOF_APPROVED notification: ${response.error}`,
                )
                throw new Error(
                    response.error || "Failed to send notification",
                )
            }

            this.logger.log(
                `EXPENSE_PROOF_APPROVED notification sent - Notification ID: ${response.notificationId}`,
            )
        } catch (error) {
            this.logger.error(
                `Error handling expense proof approved event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "ExpenseProofNotificationHandler.handleExpenseProofApproved",
                expenseProofId: event.expenseProofId,
                kitchenStaffId: event.kitchenStaffId,
            })
        }
    }

    @OnEvent("expense-proof.rejected")
    async handleExpenseProofRejected(
        event: ExpenseProofRejectedEvent,
    ): Promise<void> {
        try {
            this.logger.log(
                `[ExpenseProofNotificationHandler] Processing expense proof rejected event: ${event.expenseProofId}`,
            )

            const notificationData = {
                expenseProofId: event.expenseProofId,
                requestId: event.requestId,
                campaignTitle: event.campaignTitle,
                phaseName: event.phaseName,
                amount: event.amount,
                adminNote: event.adminNote,
                rejectedAt: event.rejectedAt,
            }

            const response = await this.grpcClient.callCampaignService<
                {
                    userId: string
                    notificationType: string
                    dataJson: string
                },
                { success: boolean; notificationId?: string; error?: string }
            >(
                "SendNotification",
                {
                    userId: event.kitchenStaffId,
                    notificationType: NotificationType.EXPENSE_PROOF_REJECTED,
                    dataJson: JSON.stringify(notificationData),
                },
                { timeout: 5000, retries: 2 },
            )

            if (!response.success) {
                this.logger.error(
                    `Failed to send EXPENSE_PROOF_REJECTED notification: ${response.error}`,
                )
                throw new Error(
                    response.error || "Failed to send notification",
                )
            }

            this.logger.log(
                `EXPENSE_PROOF_REJECTED notification sent - Notification ID: ${response.notificationId}`,
            )
        } catch (error) {
            this.logger.error(
                `Error handling expense proof rejected event: ${error.message}`,
                error.stack,
            )
            this.sentryService.captureError(error as Error, {
                operation:
                    "ExpenseProofNotificationHandler.handleExpenseProofRejected",
                expenseProofId: event.expenseProofId,
                kitchenStaffId: event.kitchenStaffId,
            })
        }
    }
}