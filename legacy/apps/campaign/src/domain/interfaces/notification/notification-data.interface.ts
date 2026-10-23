import { NotificationType } from "@app/campaign/src/domain/enums/notification"

export interface BaseNotificationData {
    metadata?: Record<string, any>
}

export interface CampaignApprovedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    approvedBy: string
    approvedAt: string
}

export interface CampaignRejectedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    rejectedBy: string
    reason?: string
}

export interface CampaignCompletedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    totalRaised: string
    totalDonors: number
    message?: string
}

export interface CampaignCancelledData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    reason?: string
}

export interface CampaignDonationReceivedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    donorCount: number
    totalAmount: string
}

export interface CampaignNewPostData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    postId: string
    postTitle: string
    postPreview: string
}

export interface PostLikeData extends BaseNotificationData {
    postId: string
    postTitle: string
    likeCount: number
    latestLikerName?: string
}

export interface PostCommentData extends BaseNotificationData {
    postId: string
    postTitle: string
    commentId: string
    commenterName: string
    commentPreview: string
}

export interface PostReplyData extends BaseNotificationData {
    postId: string
    postTitle: string
    commentId: string
    parentCommentId: string
    replierName: string
    replyPreview: string
}

export interface IngredientRequestApprovedData extends BaseNotificationData {
    ingredientRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    itemCount: number
    approvedAt: string
}

export interface IngredientRequestRejectedData extends BaseNotificationData {
    ingredientRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    itemCount: number
    adminNote: string
    rejectedAt: string
}

export interface CookingRequestApprovedData extends BaseNotificationData {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    approvedAt: string
}

export interface CookingRequestRejectedData extends BaseNotificationData {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    adminNote: string
    rejectedAt: string
}

export interface DeliveryRequestApprovedData extends BaseNotificationData {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    approvedAt: string
}

export interface DeliveryRequestRejectedData extends BaseNotificationData {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    totalCost: string
    adminNote: string
    rejectedAt: string
}

export interface DeliveryTaskAssignedData extends BaseNotificationData {
    taskId: string
    campaignTitle: string
    deliveryDate: string
    location: string
}

export interface SystemAnnouncementData extends BaseNotificationData {
    announcementId: string
    title: string
    message: string
    priority: "INFO" | "WARNING" | "CRITICAL"
}

export interface SurplusTransferredData extends BaseNotificationData {
    requestId: string
    requestType: "INGREDIENT" | "COOKING" | "DELIVERY"
    campaignTitle: string
    phaseName: string
    originalBudget: string
    actualCost: string
    surplusAmount: string
    walletTransactionId?: string
}

export interface CampaignReassignmentPendingData
    extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    organizationName: string
    expiresAt: string
    reason?: string
    reassignmentId: string
}

export interface CampaignOwnershipTransferredData
    extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    newOrganizationName: string
    newFundraiserId: string
    reassignmentId: string
}

export interface CampaignOwnershipReceivedData
    extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    organizationName: string
    reassignmentId: string
}

export interface CampaignReassignmentExpiredData
    extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    totalRefunds: number
}

export interface DisbursementCompletedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    phaseName: string
    disbursementType: "INGREDIENT" | "COOKING" | "DELIVERY"
    amount: string
    disbursedAt: string
}

export interface CampaignExtendedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    extensionDays: number
    newEndDate: string
    oldEndDate: string
}

export interface CampaignPhaseStatusUpdatedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    phaseId: string
    phaseName: string
    oldStatus: string
    newStatus: string
}

export interface ExpenseProofApprovedData extends BaseNotificationData {
    expenseProofId: string
    requestId: string
    campaignTitle: string
    phaseName: string
    amount: string
    approvedAt: string
}

export interface ExpenseProofRejectedData extends BaseNotificationData {
    expenseProofId: string
    requestId: string
    campaignTitle: string
    phaseName: string
    amount: string
    adminNote: string
    rejectedAt: string
}

export interface CampaignReassignmentAcceptedAdminData
    extends BaseNotificationData {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationName: string
    fundraiserName: string
    acceptedAt: string
    note?: string
}

export interface CampaignReassignmentRejectedAdminData
    extends BaseNotificationData {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationName: string
    fundraiserName: string
    rejectedAt: string
    note?: string
}

export type NotificationDataMap = {
    [NotificationType.CAMPAIGN_APPROVED]: CampaignApprovedData
    [NotificationType.CAMPAIGN_REJECTED]: CampaignRejectedData
    [NotificationType.CAMPAIGN_COMPLETED]: CampaignCompletedData
    [NotificationType.CAMPAIGN_CANCELLED]: CampaignCancelledData
    [NotificationType.CAMPAIGN_DONATION_RECEIVED]: CampaignDonationReceivedData
    [NotificationType.CAMPAIGN_NEW_POST]: CampaignNewPostData
    [NotificationType.CAMPAIGN_EXTENDED]: CampaignExtendedData
    [NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED]: CampaignPhaseStatusUpdatedData
    [NotificationType.POST_LIKE]: PostLikeData
    [NotificationType.POST_COMMENT]: PostCommentData
    [NotificationType.POST_REPLY]: PostReplyData
    [NotificationType.INGREDIENT_REQUEST_APPROVED]: IngredientRequestApprovedData
    [NotificationType.INGREDIENT_REQUEST_REJECTED]: IngredientRequestRejectedData
    [NotificationType.DELIVERY_TASK_ASSIGNED]: DeliveryTaskAssignedData
    [NotificationType.SYSTEM_ANNOUNCEMENT]: SystemAnnouncementData
    [NotificationType.SURPLUS_TRANSFERRED]: SurplusTransferredData
    [NotificationType.CAMPAIGN_REASSIGNMENT_PENDING]: CampaignReassignmentPendingData
    [NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED]: CampaignOwnershipTransferredData
    [NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED]: CampaignOwnershipReceivedData
    [NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED]: CampaignReassignmentExpiredData
    [NotificationType.CAMPAIGN_REASSIGNMENT_ACCEPTED_ADMIN]: CampaignReassignmentAcceptedAdminData
    [NotificationType.CAMPAIGN_REASSIGNMENT_REJECTED_ADMIN]: CampaignReassignmentRejectedAdminData
    [NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED]: DisbursementCompletedData
    [NotificationType.COOKING_DISBURSEMENT_COMPLETED]: DisbursementCompletedData
    [NotificationType.DELIVERY_DISBURSEMENT_COMPLETED]: DisbursementCompletedData
    [NotificationType.EXPENSE_PROOF_APPROVED]: ExpenseProofApprovedData
    [NotificationType.EXPENSE_PROOF_REJECTED]: ExpenseProofRejectedData
    [NotificationType.COOKING_REQUEST_APPROVED]: CookingRequestApprovedData
    [NotificationType.COOKING_REQUEST_REJECTED]: CookingRequestRejectedData
    [NotificationType.DELIVERY_REQUEST_APPROVED]: DeliveryRequestApprovedData
    [NotificationType.DELIVERY_REQUEST_REJECTED]: DeliveryRequestRejectedData
}
