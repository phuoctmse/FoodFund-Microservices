import { Injectable } from "@nestjs/common"
import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import {
    NotificationBuilder,
    NotificationBuilderContext,
    NotificationBuilderResult,
} from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class CampaignApprovedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_APPROVED> {
    readonly type = NotificationType.CAMPAIGN_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Chiến dịch "${campaignTitle}" của bạn đã được chấp nhận.`

        return {
            title: "🎉 Chiến dịch đã được chấp nhận!",
            message,
            metadata: {
                campaignId: data.campaignId,
                approvedBy: data.approvedBy,
                approvedAt: data.approvedAt,
            },
        }
    }
}

/**
 * Campaign Rejected Notification Builder
 */
@Injectable()
export class CampaignRejectedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_REJECTED> {
    readonly type = NotificationType.CAMPAIGN_REJECTED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_REJECTED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const reasonText = data.reason
            ? `Lý do: ${this.truncate(data.reason, 100)}`
            : "Hãy xem và gửi lại."
        const message = `Chiến dịch "${campaignTitle}" của bạn đã bị từ chối. ${reasonText}`

        return {
            title: "❌ Chiến dịch đã bị từ chối",
            message,
            metadata: {
                campaignId: data.campaignId,
                rejectedBy: data.rejectedBy,
                reason: data.reason,
            },
        }
    }
}

/**
 * Campaign Completed Notification Builder
 */
@Injectable()
export class CampaignCompletedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_COMPLETED> {
    readonly type = NotificationType.CAMPAIGN_COMPLETED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_COMPLETED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const totalRaised = this.formatCurrency(data.totalRaised)
        const totalDonors = this.formatNumber(data.totalDonors)

        const message =
            data.message ||
            `Chiến dịch "${campaignTitle}" đã hoàn thành! Tổng số tiền quyên góp: ${totalRaised} từ ${totalDonors} nhà hảo tâm.`

        return {
            title: "Chiến dịch đã hoàn thành!",
            message,
            metadata: {
                campaignId: data.campaignId,
                totalRaised: data.totalRaised,
                totalDonors: data.totalDonors,
            },
        }
    }
}

/**
 * Campaign Cancelled Notification Builder
 */
@Injectable()
export class CampaignCancelledBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_CANCELLED> {
    readonly type = NotificationType.CAMPAIGN_CANCELLED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_CANCELLED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const reasonText = data.reason
            ? `Lý do: ${this.truncate(data.reason, 100)}`
            : ""
        const message = `Chiến dịch "${campaignTitle}" đã bị hủy. ${reasonText}`

        return {
            title: "🚫 Chiến dịch bị hủy",
            message,
            metadata: {
                campaignId: data.campaignId,
                reason: data.reason,
            },
        }
    }
}

/**
 * Campaign Donation Received Notification Builder (Grouped)
 */
@Injectable()
export class CampaignDonationReceivedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_DONATION_RECEIVED> {
    readonly type = NotificationType.CAMPAIGN_DONATION_RECEIVED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_DONATION_RECEIVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const totalAmount = this.formatCurrency(data.totalAmount)
        const donorText =
            data.donorCount === 1
                ? "1 người ủng hộ"
                : `${this.formatNumber(data.donorCount)} người ủng hộ`
        const message = `Chiến dịch "${campaignTitle}" của bạn đã nhận ${totalAmount} từ ${donorText}.`

        return {
            title: "💰 Đã nhận thêm lượt ủng hộ!",
            message,
            metadata: {
                campaignId: data.campaignId,
                donorCount: data.donorCount,
                totalAmount: data.totalAmount,
            },
        }
    }
}

/**
 * Campaign New Post Notification Builder
 */
@Injectable()
export class CampaignNewPostBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_NEW_POST> {
    readonly type = NotificationType.CAMPAIGN_NEW_POST

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_NEW_POST>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 40)
        const postTitle = this.truncate(data.postTitle, 50)
        const message = `Chiến dịch "${campaignTitle}" đăng bài viết mới: "${postTitle}"`

        return {
            title: "Bài viết mới được tạo",
            message,
            metadata: {
                campaignId: data.campaignId,
                postId: data.postId,
                postPreview: this.truncate(data.postPreview, 200),
            },
        }
    }
}

/**
 * Campaign Reassignment Pending Notification Builder
 */
@Injectable()
export class CampaignReassignmentPendingBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_REASSIGNMENT_PENDING> {
    readonly type = NotificationType.CAMPAIGN_REASSIGNMENT_PENDING

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_REASSIGNMENT_PENDING>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Bạn được chỉ định tiếp nhận chiến dịch "${campaignTitle}". Vui lòng xác nhận để hoàn tất việc chuyển giao.`

        return {
            title: "📋 Yêu cầu tiếp nhận chiến dịch",
            message,
            metadata: {
                campaignId: data.campaignId,
                reassignmentId: data.reassignmentId,
                assignedBy: data.assignedBy,
                expiresAt: data.expiresAt,
            },
        }
    }
}

/**
 * Campaign Ownership Transferred Notification Builder
 */
@Injectable()
export class CampaignOwnershipTransferredBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED> {
    readonly type = NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const newOwnerName = data.newOwnerName || "người dùng mới"
        const message = `Chiến dịch "${campaignTitle}" đã được chuyển giao thành công cho ${newOwnerName}.`

        return {
            title: "🔄 Chiến dịch đã chuyển giao",
            message,
            metadata: {
                campaignId: data.campaignId,
                reassignmentId: data.reassignmentId,
                newOwnerId: data.newOwnerId,
            },
        }
    }
}

/**
 * Campaign Ownership Received Notification Builder
 */
@Injectable()
export class CampaignOwnershipReceivedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED> {
    readonly type = NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Bạn đã tiếp nhận thành công chiến dịch "${campaignTitle}". Giờ đây bạn là chủ sở hữu mới của chiến dịch này.`

        return {
            title: "🎉 Tiếp nhận chiến dịch thành công",
            message,
            metadata: {
                campaignId: data.campaignId,
                reassignmentId: data.reassignmentId,
                previousOwnerId: data.previousOwnerId,
            },
        }
    }
}

/**
 * Campaign Reassignment Expired Notification Builder
 */
@Injectable()
export class CampaignReassignmentExpiredBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED> {
    readonly type = NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Yêu cầu chuyển giao chiến dịch "${campaignTitle}" đã hết hạn và bị hủy tự động.`

        return {
            title: "⏰ Yêu cầu chuyển giao hết hạn",
            message,
            metadata: {
                campaignId: data.campaignId,
                reassignmentId: data.reassignmentId,
            },
        }
    }
}

/**
 * Campaign Extended Notification Builder
 */
@Injectable()
export class CampaignExtendedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_EXTENDED> {
    readonly type = NotificationType.CAMPAIGN_EXTENDED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_EXTENDED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const extensionText =
            data.extensionDays === 1 ? "1 ngày" : `${data.extensionDays} ngày`

        const newEndDate = new Date(data.newEndDate).toLocaleDateString("vi-VN")
        const message = `Chiến dịch "${campaignTitle}" đã được gia hạn thêm ${extensionText}. Thời gian kết thúc mới: ${newEndDate}.`

        return {
            title: "⏰ Chiến dịch đã được gia hạn",
            message,
            metadata: {
                campaignId: data.campaignId,
                extensionDays: data.extensionDays,
                oldEndDate: data.oldEndDate,
                newEndDate: data.newEndDate,
            },
        }
    }
}

/**
 * Campaign Phase Status Updated Notification Builder
 */
@Injectable()
export class CampaignPhaseStatusUpdatedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED> {
    readonly type = NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const phaseName = this.truncate(data.phaseName, 50)

        const statusMap: Record<string, string> = {
            PLANNING: "Lên kế hoạch",
            AWAITING_INGREDIENT_DISBURSEMENT: "Chờ giải ngân nguyên liệu",
            INGREDIENT_PURCHASE: "Mua nguyên liệu",
            AWAITING_COOKING_DISBURSEMENT: "Chờ giải ngân nấu ăn",
            COOKING: "Nấu ăn",
            AWAITING_DELIVERY_DISBURSEMENT: "Chờ giải ngân vận chuyển",
            DELIVERY: "Vận chuyển",
            COMPLETED: "Hoàn thành",
            CANCELLED: "Đã hủy",
            FAILED: "Thất bại",
        }

        const newStatusText = statusMap[data.newStatus] || data.newStatus
        const message = `Giai đoạn "${phaseName}" của chiến dịch "${campaignTitle}" đã chuyển sang trạng thái "${newStatusText}".`

        return {
            title: "📋 Cập nhật tiến độ chiến dịch",
            message,
            metadata: {
                campaignId: data.campaignId,
                phaseId: data.phaseId,
                phaseName: data.phaseName,
                oldStatus: data.oldStatus,
                newStatus: data.newStatus,
            },
        }
    }
}
