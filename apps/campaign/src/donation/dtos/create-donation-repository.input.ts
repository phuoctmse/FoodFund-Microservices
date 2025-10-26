export interface CreateDonationRepositoryInput {
    donor_id: string
    campaign_id: string
    amount: bigint
    message?: string
    is_anonymous: boolean
}