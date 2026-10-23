import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import { NotificationBuilder, NotificationBuilderContext, NotificationBuilderResult } from "@app/campaign/src/domain/interfaces/notification"
import { Injectable } from "@nestjs/common"

@Injectable()
export class IngredientDisbursementCompletedBuilder extends NotificationBuilder<NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED> {
    readonly type = NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED

    build(
        context: NotificationBuilderContext<NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 30)
        const amountFormatted = this.formatCurrency(data.amount)

        const message =
            "Giải ngân chi phí nguyên liệu đã hoàn tất! " +
            `Chiến dịch: "${campaignTitle}", Giai đoạn: "${phaseName}". ` +
            `Số tiền: ${amountFormatted}. ` +
            "Vui lòng kiểm tra tài khoản ngân hàng của bạn."

        return {
            title: "Giải Ngân Chi Phí Nguyên Liệu Thành Công",
            message,
            metadata: {
                campaignId: data.campaignId,
                phaseName: data.phaseName,
                amount: data.amount,
                disbursementType: "INGREDIENT",
            },
        }
    }
}

@Injectable()
export class CookingDisbursementCompletedBuilder extends NotificationBuilder<NotificationType.COOKING_DISBURSEMENT_COMPLETED> {
    readonly type = NotificationType.COOKING_DISBURSEMENT_COMPLETED

    build(
        context: NotificationBuilderContext<NotificationType.COOKING_DISBURSEMENT_COMPLETED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 30)
        const amountFormatted = this.formatCurrency(data.amount)

        const message =
            "Giải ngân chi phí nấu ăn đã hoàn tất! " +
            `Chiến dịch: "${campaignTitle}", Giai đoạn: "${phaseName}". ` +
            `Số tiền: ${amountFormatted}. ` +
            "Vui lòng kiểm tra tài khoản ngân hàng của bạn."

        return {
            title: "Giải Ngân Chi Phí Nấu Ăn Thành Công",
            message,
            metadata: {
                campaignId: data.campaignId,
                phaseName: data.phaseName,
                amount: data.amount,
                disbursementType: "COOKING",
            },
        }
    }
}

@Injectable()
export class DeliveryDisbursementCompletedBuilder extends NotificationBuilder<NotificationType.DELIVERY_DISBURSEMENT_COMPLETED> {
    readonly type = NotificationType.DELIVERY_DISBURSEMENT_COMPLETED

    build(
        context: NotificationBuilderContext<NotificationType.DELIVERY_DISBURSEMENT_COMPLETED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 30)
        const amountFormatted = this.formatCurrency(data.amount)

        const message =
            "Giải ngân chi phí giao hàng đã hoàn tất! " +
            `Chiến dịch: "${campaignTitle}", Giai đoạn: "${phaseName}". ` +
            `Số tiền: ${amountFormatted}. ` +
            "Vui lòng kiểm tra tài khoản ngân hàng của bạn."

        return {
            title: "Giải Ngân Chi Phí Vận Chuyển Thành Công",
            message,
            metadata: {
                campaignId: data.campaignId,
                phaseName: data.phaseName,
                amount: data.amount,
                disbursementType: "DELIVERY",
            },
        }
    }
}