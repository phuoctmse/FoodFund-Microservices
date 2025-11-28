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