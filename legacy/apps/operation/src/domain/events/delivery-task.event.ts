export interface DeliveryTaskAssignedEvent {
    taskId: string
    deliveryStaffId: string
    mealBatchId: string
    campaignId: string
    campaignPhaseId: string
    campaignTitle: string
    phaseName: string
    foodName: string
    quantity: number
    location: string
    assignedBy: string
    fundraiserName: string
    organizationName: string
}