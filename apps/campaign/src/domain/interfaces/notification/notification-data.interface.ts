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
}