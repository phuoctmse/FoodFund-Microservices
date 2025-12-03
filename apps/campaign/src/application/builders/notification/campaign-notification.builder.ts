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
