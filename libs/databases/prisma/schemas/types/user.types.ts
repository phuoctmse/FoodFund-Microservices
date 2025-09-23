import { AvailabilityStatus, Role, VerificationStatus } from "../enums/user.enums"

// Shared GraphQL Federation Types
export interface UserReference {
    id: string
    __typename: string
}

// Database Entity Types (for shared usage)
export interface UserWithProfiles {
    id: string
    full_name: string
    avatar_url: string
    email: string
    phone_number: string
    role: Role
    is_active: boolean
    user_name: string
    bio?: string
    created_at: Date
    updated_at: Date
    Donor_Profile?: DonorProfile | null
    Kitchen_Staff_Profile?: KitchenStaffProfile | null
    Fundraiser_Profile?: FundraiserProfile | null
    Delivery_Staff_Profile?: DeliveryStaffProfile | null
}

export interface DonorProfile {
    id: string
    user_id: string
    donation_count: number
    total_donated: bigint
    created_at: Date
    updated_at: Date
}

export interface KitchenStaffProfile {
    id: string
    user_id: string
    total_batch_prepared: number
    created_at: Date
    updated_at: Date
}

export interface FundraiserProfile {
    id: string
    user_id: string
    organization_address?: string
    verification_status: VerificationStatus
    total_campaign_created: number
    created_at: Date
    updated_at: Date
}

export interface DeliveryStaffProfile {
    id: string
    user_id: string
    availability_status: AvailabilityStatus
    total_deliveries: number
    created_at: Date
    updated_at: Date
}
