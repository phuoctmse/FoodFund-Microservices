import { Role, VerificationStatus, AvailabilityStatus } from "libs/databases/prisma/schemas"

// User Domain Types
export interface CreateUserInput {
    cognito_id?: string
    full_name: string
    avatar_url: string
    email: string
    phone_number: string
    role: Role
    user_name: string
    bio?: string
    cognito_attributes?: Record<string, string>
}

export interface CreateStaffUserInput {
    cognito_id: string
    full_name: string
    avatar_url: string
    email: string
    phone_number: string
    role: Role
    user_name: string
    bio?: string
    organization_address?: string // For FUNDRAISER
}

export interface UpdateUserInput {
    cognito_id?: string
    full_name?: string
    avatar_url?: string
    email?: string
    phone_number?: string
    role?: Role
    is_active?: boolean
    user_name?: string
    bio?: string
}

// Profile Types
export interface CreateDonorProfileInput {
    user_id: string
}

export interface UpdateDonorProfileInput {
    donation_count?: number
    total_donated?: bigint
}

export interface CreateKitchenStaffProfileInput {
    user_id: string
}

export interface UpdateKitchenStaffProfileInput {
    total_batch_prepared?: number
}

export interface CreateFundraiserProfileInput {
    user_id: string
    organization_address?: string
}

export interface UpdateFundraiserProfileInput {
    organization_address?: string
    verification_status?: VerificationStatus
    total_campaign_created?: number
}

export interface CreateDeliveryStaffProfileInput {
    user_id: string
}

export interface UpdateDeliveryStaffProfileInput {
    availability_status?: AvailabilityStatus
    total_deliveries?: number
}
