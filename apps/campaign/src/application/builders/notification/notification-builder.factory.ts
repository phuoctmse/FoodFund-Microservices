import { NotificationType } from "@app/campaign/src/domain/enums/notification"
import { Injectable } from "@nestjs/common"
import {
    CampaignApprovedBuilder,
    CampaignCancelledBuilder,
    CampaignCompletedBuilder,
    CampaignDonationReceivedBuilder,
    CampaignNewPostBuilder,
    CampaignRejectedBuilder,
    CampaignReassignmentPendingBuilder,
    CampaignOwnershipTransferredBuilder,
    CampaignOwnershipReceivedBuilder,
    CampaignReassignmentExpiredBuilder,
} from "./campaign-notification.builder"
import {
    PostCommentBuilder,
    PostLikeBuilder,
    PostReplyBuilder,
} from "./post-notification.builder"
import {
    DeliveryTaskAssignedBuilder,
    IngredientRequestApprovedBuilder,
    SurplusTransferredBuilder,
    SystemAnnouncementBuilder,
} from "./operation-notification.builder"
import {
    NotificationBuilder,
    NotificationBuilderContext,
    NotificationBuilderResult,
    NotificationDataMap,
} from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class NotificationBuilderFactory {
    private readonly builders: Map<NotificationType, NotificationBuilder<any>>

    constructor(
        private readonly campaignApprovedBuilder: CampaignApprovedBuilder,
        private readonly campaignRejectedBuilder: CampaignRejectedBuilder,
        private readonly campaignCompletedBuilder: CampaignCompletedBuilder,
        private readonly campaignCancelledBuilder: CampaignCancelledBuilder,
        private readonly campaignDonationReceivedBuilder: CampaignDonationReceivedBuilder,
        private readonly campaignNewPostBuilder: CampaignNewPostBuilder,

        private readonly postLikeBuilder: PostLikeBuilder,
        private readonly postCommentBuilder: PostCommentBuilder,
        private readonly postReplyBuilder: PostReplyBuilder,

        private readonly ingredientRequestApprovedBuilder: IngredientRequestApprovedBuilder,
        private readonly deliveryTaskAssignedBuilder: DeliveryTaskAssignedBuilder,
        private readonly systemAnnouncementBuilder: SystemAnnouncementBuilder,
        private readonly surplusTransferredBuilder: SurplusTransferredBuilder,

        private readonly campaignReassignmentPendingBuilder: CampaignReassignmentPendingBuilder,
        private readonly campaignOwnershipTransferredBuilder: CampaignOwnershipTransferredBuilder,
        private readonly campaignOwnershipReceivedBuilder: CampaignOwnershipReceivedBuilder,
        private readonly campaignReassignmentExpiredBuilder: CampaignReassignmentExpiredBuilder,
    ) {
        this.builders = new Map<NotificationType, NotificationBuilder<any>>()

        this.builders.set(
            NotificationType.CAMPAIGN_APPROVED,
            this.campaignApprovedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_REJECTED,
            this.campaignRejectedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_COMPLETED,
            this.campaignCompletedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_CANCELLED,
            this.campaignCancelledBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_DONATION_RECEIVED,
            this.campaignDonationReceivedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_NEW_POST,
            this.campaignNewPostBuilder,
        )

        this.builders.set(NotificationType.POST_LIKE, this.postLikeBuilder)
        this.builders.set(
            NotificationType.POST_COMMENT,
            this.postCommentBuilder,
        )
        this.builders.set(NotificationType.POST_REPLY, this.postReplyBuilder)

        this.builders.set(
            NotificationType.INGREDIENT_REQUEST_APPROVED,
            this.ingredientRequestApprovedBuilder,
        )
        this.builders.set(
            NotificationType.DELIVERY_TASK_ASSIGNED,
            this.deliveryTaskAssignedBuilder,
        )
        this.builders.set(
            NotificationType.SYSTEM_ANNOUNCEMENT,
            this.systemAnnouncementBuilder,
        )
        this.builders.set(
            NotificationType.SURPLUS_TRANSFERRED,
            this.surplusTransferredBuilder,
        )

        this.builders.set(
            NotificationType.CAMPAIGN_REASSIGNMENT_PENDING,
            this.campaignReassignmentPendingBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED,
            this.campaignOwnershipTransferredBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED,
            this.campaignOwnershipReceivedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED,
            this.campaignReassignmentExpiredBuilder,
        )
    }

    build<T extends NotificationType & keyof NotificationDataMap>(
        context: NotificationBuilderContext<T>,
    ): NotificationBuilderResult {
        const builder = this.builders.get(context.type)

        if (!builder) {
            throw new Error(`Unsupported notification type: ${context.type}`)
        }
        const result = builder.build(context)
        return result
    }

    getBuilder<T extends NotificationType & keyof NotificationDataMap>(
        type: T,
    ): NotificationBuilder<T> | undefined {
        return this.builders.get(type)
    }

    hasBuilder(type: NotificationType): boolean {
        return this.builders.has(type)
    }

    getSupportedTypes(): NotificationType[] {
        return Array.from(this.builders.keys())
    }
}
