export interface CampaignApprovedEvent {
    campaignId: string
    campaignTitle: string
    fundraiserId: string
    approvedBy: string
    approvedAt: string
}

export interface CampaignRejectedEvent {
    campaignId: string
    campaignTitle: string
    fundraiserId: string
    rejectedBy: string
    reason?: string
}

export interface CampaignCompletedEvent {
    campaignId: string
    campaignTitle: string
    fundraiserId: string
    totalRaised: string
    totalDonors: number
}

export interface CampaignCancelledEvent {
    campaignId: string
    campaignTitle: string
    fundraiserId: string
    reason?: string
    previousStatus: string
}

export interface CampaignDonationReceivedEvent {
    donationId: string
    campaignId: string
    campaignTitle: string
    fundraiserId: string
    donorId: string
    amount: string
}

export interface CampaignNewPostEvent {
    postId: string
    campaignId: string
    campaignTitle: string
    authorId: string
    postTitle: string
    postPreview: string
    followerIds: string[]
}
