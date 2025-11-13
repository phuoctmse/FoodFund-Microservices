export interface CreateDonationRepositoryInput {
    donor_id: string
    donor_name?: string
    campaign_id: string
    amount: bigint
    is_anonymous: boolean
}
