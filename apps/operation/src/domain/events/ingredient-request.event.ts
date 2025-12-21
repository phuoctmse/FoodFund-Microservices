export interface IngredientRequestApprovedEvent {
    ingredientRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    itemCount: number
    approvedAt: string
}

export interface IngredientRequestRejectedEvent {
    ingredientRequestId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    fundraiserId: string
    organizationId: string | null
    totalCost: string
    itemCount: number
    adminNote: string
    rejectedAt: string
}