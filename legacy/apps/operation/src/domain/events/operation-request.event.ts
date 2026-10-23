export interface CookingRequestApprovedEvent {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    approvedAt: string
}

export interface CookingRequestRejectedEvent {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    adminNote: string
    rejectedAt: string
}

export interface DeliveryRequestApprovedEvent {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    approvedAt: string
}

export interface DeliveryRequestRejectedEvent {
    operationRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    adminNote: string
    rejectedAt: string
}