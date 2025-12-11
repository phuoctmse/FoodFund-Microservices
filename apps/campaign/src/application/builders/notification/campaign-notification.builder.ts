import { Injectable } from "@nestjs/common"
import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import { NotificationBuilder, NotificationBuilderContext, NotificationBuilderResult } from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class CampaignApprovedBuilder extends NotificationBuilder<NotificationType.CAMPAIGN_APPROVED> {
    readonly type = NotificationType.CAMPAIGN_APPROVED

    build(
        context: NotificationBuilderContext<NotificationType.CAMPAIGN_APPROVED>,
    ): NotificationBuilderResult {
        this.validate(context.data)
        const data = context.data

        const campaignTitle = this.truncate(data.campaignTitle, 50)
        const message = `Your campaign "${campaignTitle}" has been approved and is now live.`

        return {
            title: "🎉 Campaign Approved!",
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
            ? `Reason: ${this.truncate(data.reason, 100)}`
            : "Please review and resubmit."
        const message = `Your campaign "${campaignTitle}" was rejected. ${reasonText}`

        return {
            title: "❌ Campaign Rejected",
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
            ? `Reason: ${this.truncate(data.reason, 100)}`
            : ""
        const message = `Campaign "${campaignTitle}" has been cancelled. ${reasonText}`

        return {
            title: "🚫 Campaign Cancelled",
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
                ? "1 donor"
                : `${this.formatNumber(data.donorCount)} donors`
        const message = `Your campaign "${campaignTitle}" received ${totalAmount} from ${donorText}.`

        return {
            title: "💰 New Donations Received!",
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
        const message = `"${campaignTitle}" posted: "${postTitle}"`

        return {
            title: "📝 New Post Published",
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
