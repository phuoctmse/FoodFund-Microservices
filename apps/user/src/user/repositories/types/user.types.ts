import { Role } from "libs/databases/prisma/schemas"

// User creation types
export interface CreateUserInput {
    cognito_id: string
    email: string
    user_name: string
    full_name: string
    phone_number?: string
    avatar_url?: string
    bio?: string
    role: Role
}

export interface CreateStaffUserInput {
    cognito_id: string
    email: string
    user_name: string
    full_name: string
    phone_number?: string
    avatar_url?: string
    bio?: string
    role: Role
    organization_address?: string
}

export interface UpdateUserInput {
    full_name?: string
    phone_number?: string
    avatar_url?: string
    bio?: string
    is_active?: boolean
}

// Profile types
export interface CreateDonorProfileInput {
    user_id: string
}

export interface UpdateDonorProfileInput {
    donation_count?: number
    total_donated?: number
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
    verification_status?: string
    total_campaign_created?: number
}

export interface CreateDeliveryStaffProfileInput {
    user_id: string
}

export interface UpdateDeliveryStaffProfileInput {
    availability_status?: string
    total_deliveries?: number
}