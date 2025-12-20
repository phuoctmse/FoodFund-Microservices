export interface ExpenseProofApprovedEvent {
    expenseProofId: string
    requestId: string
    kitchenStaffId: string
    campaignTitle: string
    phaseName: string
    amount: string
    approvedAt: string
}

export interface ExpenseProofRejectedEvent {
    expenseProofId: string
    requestId: string
    kitchenStaffId: string
    campaignTitle: string
    phaseName: string
    amount: string
    adminNote: string
    rejectedAt: string
}