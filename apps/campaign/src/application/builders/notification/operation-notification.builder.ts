import { Injectable } from "@nestjs/common"
import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import {
    NotificationBuilder,
    NotificationBuilderContext,
    NotificationBuilderResult,
} from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class IngredientRequestApprovedBuilder extends NotificationBuilder<NotificationType.INGREDIENT_REQUEST_APPROVED> {
    readonly type = NotificationType.INGREDIENT_REQUEST_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.INGREDIENT_REQUEST_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Your ingredient request for "${campaignTitle}" has been approved by ${data.approvedBy}.`

        return {
            title: "Ingredient Request Approved",
            message,
            metadata: {
                requestId: data.requestId,
                campaignTitle: data.campaignTitle,
                approvedBy: data.approvedBy,
            },
        }
    }
}

/**
 * Delivery Task Assigned Notification Builder
 */
@Injectable()
export class DeliveryTaskAssignedBuilder extends NotificationBuilder<NotificationType.DELIVERY_TASK_ASSIGNED> {
    readonly type = NotificationType.DELIVERY_TASK_ASSIGNED

    build(
        context: NotificationBuilderContext<NotificationType.DELIVERY_TASK_ASSIGNED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `You have been assigned a delivery task for "${campaignTitle}" on ${data.deliveryDate} at ${data.location}.`

        return {
            title: "New Delivery Task",
            message,
            metadata: {
                taskId: data.taskId,
                campaignTitle: data.campaignTitle,
                deliveryDate: data.deliveryDate,
                location: data.location,
            },
        }
    }
}

/**
 * System Announcement Notification Builder
 */
@Injectable()
export class SystemAnnouncementBuilder extends NotificationBuilder<NotificationType.SYSTEM_ANNOUNCEMENT> {
    readonly type = NotificationType.SYSTEM_ANNOUNCEMENT

    build(
        context: NotificationBuilderContext<NotificationType.SYSTEM_ANNOUNCEMENT>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const icon = {
            INFO: "ℹ️",
            WARNING: "⚠️",
            CRITICAL: "🚨",
        }[data.priority]

        const truncatedMessage = this.truncate(data.message, 200)
        const message = `${data.title}: ${truncatedMessage}`

        return {
            title: `${icon} System Announcement`,
            message,
            metadata: {
                announcementId: data.announcementId,
                priority: data.priority,
            },
        }
    }
}

@Injectable()
export class SurplusTransferredBuilder extends NotificationBuilder<NotificationType.SURPLUS_TRANSFERRED> {
    readonly type = NotificationType.SURPLUS_TRANSFERRED

    build(
        context: NotificationBuilderContext<NotificationType.SURPLUS_TRANSFERRED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 40)
        const phaseName = this.truncate(data.phaseName, 30)
        const surplusFormatted = this.formatCurrency(data.surplusAmount)
        const originalBudgetFormatted = this.formatCurrency(data.originalBudget)
        const actualCostFormatted = this.formatCurrency(data.actualCost)

        const requestTypeLabel = {
            INGREDIENT: "nguyên liệu",
            COOKING: "nấu ăn",
            DELIVERY: "giao hàng",
        }[data.requestType]

        const message =
            `Tiền dư từ yêu cầu ${requestTypeLabel} đã được chuyển vào ví của bạn. ` +
            `Chiến dịch: "${campaignTitle}" - Giai đoạn: "${phaseName}". ` +
            `Ngân sách: ${originalBudgetFormatted}, Chi phí thực tế: ${actualCostFormatted}, ` +
            `Tiền dư: ${surplusFormatted}.`

        return {
            title: "Tiền dư đã được chuyển vào ví",
            message,
            metadata: {
                requestId: data.requestId,
                requestType: data.requestType,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                originalBudget: data.originalBudget,
                actualCost: data.actualCost,
                surplusAmount: data.surplusAmount,
                walletTransactionId: data.walletTransactionId,
            },
        }
    }
}
