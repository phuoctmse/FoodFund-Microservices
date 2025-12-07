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
    requestId: string
    campaignTitle: string
    approvedBy: string
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

export interface CampaignReassignmentPendingData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    reassignmentId: string
    assignedBy: string
    expiresAt?: string
}

export interface CampaignOwnershipTransferredData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    reassignmentId: string
    newOwnerId: string
    newOwnerName?: string
}

export interface CampaignOwnershipReceivedData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    reassignmentId: string
    previousOwnerId: string
    previousOwnerName?: string
}

export interface CampaignReassignmentExpiredData extends BaseNotificationData {
    campaignId: string
    campaignTitle: string
    reassignmentId: string
}

export type NotificationDataMap = {
    [NotificationType.CAMPAIGN_APPROVED]: CampaignApprovedData
    [NotificationType.CAMPAIGN_REJECTED]: CampaignRejectedData
    [NotificationType.CAMPAIGN_COMPLETED]: CampaignCompletedData
    [NotificationType.CAMPAIGN_CANCELLED]: CampaignCancelledData
    [NotificationType.CAMPAIGN_DONATION_RECEIVED]: CampaignDonationReceivedData
    [NotificationType.CAMPAIGN_NEW_POST]: CampaignNewPostData
    [NotificationType.POST_LIKE]: PostLikeData
    [NotificationType.POST_COMMENT]: PostCommentData
    [NotificationType.POST_REPLY]: PostReplyData
    [NotificationType.INGREDIENT_REQUEST_APPROVED]: IngredientRequestApprovedData
    [NotificationType.DELIVERY_TASK_ASSIGNED]: DeliveryTaskAssignedData
    [NotificationType.SYSTEM_ANNOUNCEMENT]: SystemAnnouncementData
    [NotificationType.SURPLUS_TRANSFERRED]: SurplusTransferredData
    [NotificationType.CAMPAIGN_REASSIGNMENT_PENDING]: CampaignReassignmentPendingData
    [NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED]: CampaignOwnershipTransferredData
    [NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED]: CampaignOwnershipReceivedData
    [NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED]: CampaignReassignmentExpiredData
}