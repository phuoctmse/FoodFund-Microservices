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
    CampaignExtendedBuilder,
    CampaignPhaseStatusUpdatedBuilder,
    CampaignReassignmentAcceptedAdminBuilder,
    CampaignReassignmentRejectedAdminBuilder,
} from "./campaign-notification.builder"
import {
    PostCommentBuilder,
    PostLikeBuilder,
    PostReplyBuilder,
} from "./post-notification.builder"
import {
    CookingRequestApprovedBuilder,
    CookingRequestRejectedBuilder,
    DeliveryRequestApprovedBuilder,
    DeliveryRequestRejectedBuilder,
    DeliveryTaskAssignedBuilder,
    ExpenseProofApprovedBuilder,
    ExpenseProofRejectedBuilder,
    IngredientRequestApprovedBuilder,
    IngredientRequestRejectedBuilder,
    SurplusTransferredBuilder,
    SystemAnnouncementBuilder,
} from "./operation-notification.builder"
import {
    NotificationBuilder,
    NotificationBuilderContext,
    NotificationBuilderResult,
    NotificationDataMap,
} from "@app/campaign/src/domain/interfaces/notification"
import {
    CookingDisbursementCompletedBuilder,
    DeliveryDisbursementCompletedBuilder,
    IngredientDisbursementCompletedBuilder,
} from "./disbursement-notification.builder"

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
        private readonly ingredientRequestRejectedBuilder: IngredientRequestRejectedBuilder,

        private readonly deliveryTaskAssignedBuilder: DeliveryTaskAssignedBuilder,
        private readonly systemAnnouncementBuilder: SystemAnnouncementBuilder,
        private readonly surplusTransferredBuilder: SurplusTransferredBuilder,

        private readonly campaignReassignmentPendingBuilder: CampaignReassignmentPendingBuilder,
        private readonly campaignOwnershipTransferredBuilder: CampaignOwnershipTransferredBuilder,
        private readonly campaignOwnershipReceivedBuilder: CampaignOwnershipReceivedBuilder,
        private readonly campaignReassignmentExpiredBuilder: CampaignReassignmentExpiredBuilder,
        private readonly campaignReassignmentAcceptedAdminBuilder: CampaignReassignmentAcceptedAdminBuilder,
        private readonly campaignReassignmentRejectedAdminBuilder: CampaignReassignmentRejectedAdminBuilder,
        private readonly ingredientDisbursementBuilder: IngredientDisbursementCompletedBuilder,
        private readonly cookingDisbursementBuilder: CookingDisbursementCompletedBuilder,
        private readonly deliveryDisbursementBuilder: DeliveryDisbursementCompletedBuilder,
        private readonly campaignExtendedBuilder: CampaignExtendedBuilder,
        private readonly campaignPhaseStatusUpdatedBuilder: CampaignPhaseStatusUpdatedBuilder,
        private readonly expenseProofApprovedBuilder: ExpenseProofApprovedBuilder,
        private readonly expenseProofRejectedBuilder: ExpenseProofRejectedBuilder,
        private readonly cookingRequestApprovedBuilder: CookingRequestApprovedBuilder,
        private readonly cookingRequestRejectedBuilder: CookingRequestRejectedBuilder,
        private readonly deliveryRequestApprovedBuilder: DeliveryRequestApprovedBuilder,
        private readonly deliveryRequestRejectedBuilder: DeliveryRequestRejectedBuilder,
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
            NotificationType.INGREDIENT_REQUEST_REJECTED,
            this.ingredientRequestRejectedBuilder,
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
        this.builders.set(
            NotificationType.CAMPAIGN_REASSIGNMENT_ACCEPTED_ADMIN,
            this.campaignReassignmentAcceptedAdminBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_REASSIGNMENT_REJECTED_ADMIN,
            this.campaignReassignmentRejectedAdminBuilder,
        )
        this.builders.set(
            NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED,
            this.ingredientDisbursementBuilder,
        )
        this.builders.set(
            NotificationType.COOKING_DISBURSEMENT_COMPLETED,
            this.cookingDisbursementBuilder,
        )
        this.builders.set(
            NotificationType.DELIVERY_DISBURSEMENT_COMPLETED,
            this.deliveryDisbursementBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_EXTENDED,
            this.campaignExtendedBuilder,
        )
        this.builders.set(
            NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED,
            this.campaignPhaseStatusUpdatedBuilder,
        )
        this.builders.set(
            NotificationType.EXPENSE_PROOF_APPROVED,
            this.expenseProofApprovedBuilder,
        )
        this.builders.set(
            NotificationType.EXPENSE_PROOF_REJECTED,
            this.expenseProofRejectedBuilder,
        )
        this.builders.set(
            NotificationType.COOKING_REQUEST_APPROVED,
            this.cookingRequestApprovedBuilder,
        )
        this.builders.set(
            NotificationType.COOKING_REQUEST_REJECTED,
            this.cookingRequestRejectedBuilder,
        )
        this.builders.set(
            NotificationType.DELIVERY_REQUEST_APPROVED,
            this.deliveryRequestApprovedBuilder,
        )
        this.builders.set(
            NotificationType.DELIVERY_REQUEST_REJECTED,
            this.deliveryRequestRejectedBuilder,
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
