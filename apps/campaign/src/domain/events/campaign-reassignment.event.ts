export interface CampaignReassignmentAssignedEvent {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationId: string
    organizationName: string
    fundraiserId: string
    assignedBy: string
    expiresAt: Date
    reason?: string
}

export interface CampaignReassignmentApprovedEvent {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    newOrganizationId: string
    newOrganizationName: string
    newFundraiserId: string
    previousOrganizationId?: string
    previousFundraiserId: string
    acceptedBy: string
}

export interface CampaignReassignmentExpiredEvent {
    campaignId: string
    campaignTitle: string
    totalRefunds: number
    originalOrganizationId?: string
    originalFundraiserId: string
}

export interface CampaignReassignmentReceivedEvent {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationName: string
    targetAmount: string
    receivedAmount: string
}

export interface CampaignReassignmentAcceptedAdminEvent {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationId: string
    organizationName: string
    fundraiserId: string
    fundraiserName: string
    acceptedBy: string
    note?: string
}

export interface CampaignReassignmentRejectedAdminEvent {
    reassignmentId: string
    campaignId: string
    campaignTitle: string
    organizationId: string
    organizationName: string
    fundraiserId: string
    fundraiserName: string
    rejectedBy: string
    note?: string
}