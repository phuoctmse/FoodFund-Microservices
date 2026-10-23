import { Injectable } from "@nestjs/common"
import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import {
    NotificationBuilder,
    NotificationBuilderContext,
    NotificationBuilderResult,
} from "@app/campaign/src/domain/interfaces/notification"

/**
 * Ingredient Request Approved Notification Builder
 */
@Injectable()
export class IngredientRequestApprovedBuilder extends NotificationBuilder<NotificationType.INGREDIENT_REQUEST_APPROVED> {
    readonly type = NotificationType.INGREDIENT_REQUEST_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.INGREDIENT_REQUEST_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)

        const message =
            `Yêu cầu nguyên liệu cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã được phê duyệt. ` +
            `Tổng chi phí: ${costFormatted}.`

        return {
            title: "Yêu Cầu Nguyên Liệu Được Phê Duyệt",
            message,
            metadata: {
                ingredientRequestId: data.ingredientRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
            },
        }
    }
}

/**
 * Ingredient Request Rejected Notification Builder
 */
@Injectable()
export class IngredientRequestRejectedBuilder extends NotificationBuilder<NotificationType.INGREDIENT_REQUEST_REJECTED> {
    readonly type = NotificationType.INGREDIENT_REQUEST_REJECTED

    build(
        context: NotificationBuilderContext<NotificationType.INGREDIENT_REQUEST_REJECTED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)
        const adminNote = this.truncate(data.adminNote, 100)

        const message =
            `Yêu cầu nguyên liệu cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã bị từ chối. ` +
            `Tổng chi phí: ${costFormatted}.` +
            `Lý do: ${adminNote}. Vui lòng tạo mới và nộp lại.`

        return {
            title: "Yêu Cầu Nguyên Liệu Bị Từ Chối",
            message,
            metadata: {
                ingredientRequestId: data.ingredientRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
                itemCount: data.itemCount,
                adminNote: data.adminNote,
            },
        }
    }
}

/**
 * Expense Proof Approved Notification Builder
 */
@Injectable()
export class ExpenseProofApprovedBuilder extends NotificationBuilder<NotificationType.EXPENSE_PROOF_APPROVED> {
    readonly type = NotificationType.EXPENSE_PROOF_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.EXPENSE_PROOF_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)

        const message =
            "Biên lai chi phí đã được phê duyệt! " +
            `Chiến dịch: "${campaignTitle}", Giai đoạn: "${phaseName}". `

        return {
            title: "Biên Lai Chi Phí Được Phê Duyệt",
            message,
            metadata: {
                expenseProofId: data.expenseProofId,
                requestId: data.requestId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                amount: data.amount,
            },
        }
    }
}

/**
 * Expense Proof Rejected Notification Builder
 */
@Injectable()
export class ExpenseProofRejectedBuilder extends NotificationBuilder<NotificationType.EXPENSE_PROOF_REJECTED> {
    readonly type = NotificationType.EXPENSE_PROOF_REJECTED

    build(
        context: NotificationBuilderContext<NotificationType.EXPENSE_PROOF_REJECTED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const adminNote = this.truncate(data.adminNote, 100)

        const message =
            "Biên lai chi phí đã bị từ chối. " +
            `Chiến dịch: "${campaignTitle}", Giai đoạn: "${phaseName}". ` +
            `Lý do: ${adminNote}. ` +
            "Vui lòng tạo mới biên lai và nộp lại."

        return {
            title: "Biên Lai Chi Phí Bị Từ Chối",
            message,
            metadata: {
                expenseProofId: data.expenseProofId,
                requestId: data.requestId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                amount: data.amount,
                adminNote: data.adminNote,
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
        const message = `Bạn đã được giao một công việc vận chuyển cho chiến dịch "${campaignTitle}" tại ${data.location}.`

        return {
            title: "Công việc vận chuyển mới",
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

/**
 * Cooking Request Approved Notification Builder
 */
@Injectable()
export class CookingRequestApprovedBuilder extends NotificationBuilder<NotificationType.COOKING_REQUEST_APPROVED> {
    readonly type = NotificationType.COOKING_REQUEST_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.COOKING_REQUEST_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)

        const message =
            `Yêu cầu chi phí nấu ăn cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã được phê duyệt. ` +
            `Tổng chi phí: ${costFormatted}.`

        return {
            title: "Yêu Cầu Chi Phí Nấu Ăn Được Phê Duyệt",
            message,
            metadata: {
                operationRequestId: data.operationRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
            },
        }
    }
}

/**
 * Cooking Request Rejected Notification Builder
 */
@Injectable()
export class CookingRequestRejectedBuilder extends NotificationBuilder<NotificationType.COOKING_REQUEST_REJECTED> {
    readonly type = NotificationType.COOKING_REQUEST_REJECTED

    build(
        context: NotificationBuilderContext<NotificationType.COOKING_REQUEST_REJECTED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)
        const adminNote = this.truncate(data.adminNote, 100)

        const message =
            `Yêu cầu chi phí nấu ăn cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã bị từ chối. ` +
            `Tổng chi phí: ${costFormatted}. ` +
            `Lý do: ${adminNote}. Vui lòng tạo mới và nộp lại.`

        return {
            title: "Yêu Cầu Chi Phí Nấu Ăn Bị Từ Chối",
            message,
            metadata: {
                operationRequestId: data.operationRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
                adminNote: data.adminNote,
            },
        }
    }
}

/**
 * Delivery Request Approved Notification Builder
 */
@Injectable()
export class DeliveryRequestApprovedBuilder extends NotificationBuilder<NotificationType.DELIVERY_REQUEST_APPROVED> {
    readonly type = NotificationType.DELIVERY_REQUEST_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.DELIVERY_REQUEST_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)

        const message =
            `Yêu cầu chi phí giao hàng cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã được phê duyệt. ` +
            `Tổng chi phí: ${costFormatted}.`

        return {
            title: "Yêu Cầu Chi Phí Giao Hàng Được Phê Duyệt",
            message,
            metadata: {
                operationRequestId: data.operationRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
            },
        }
    }
}

/**
 * Delivery Request Rejected Notification Builder
 */
@Injectable()
export class DeliveryRequestRejectedBuilder extends NotificationBuilder<NotificationType.DELIVERY_REQUEST_REJECTED> {
    readonly type = NotificationType.DELIVERY_REQUEST_REJECTED

    build(
        context: NotificationBuilderContext<NotificationType.DELIVERY_REQUEST_REJECTED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 40)
        const costFormatted = this.formatCurrency(data.totalCost)
        const adminNote = this.truncate(data.adminNote, 100)

        const message =
            `Yêu cầu chi phí giao hàng cho chiến dịch "${campaignTitle}", ` +
            `giai đoạn "${phaseName}" đã bị từ chối. ` +
            `Tổng chi phí: ${costFormatted}. ` +
            `Lý do: ${adminNote}. Vui lòng tạo mới và nộp lại.`

        return {
            title: "Yêu Cầu Chi Phí Giao Hàng Bị Từ Chối",
            message,
            metadata: {
                operationRequestId: data.operationRequestId,
                campaignId: data.campaignId,
                campaignPhaseId: data.campaignPhaseId,
                campaignTitle: data.campaignTitle,
                phaseName: data.phaseName,
                totalCost: data.totalCost,
                adminNote: data.adminNote,
            },
        }
    }
}
