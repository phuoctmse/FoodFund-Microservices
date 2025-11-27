export interface CreateUserRequest {
    cognitoId: string
    email: string
    username?: string
    fullName: string
    role?: string
    cognitoAttributes?: {
        avatarUrl?: string
        bio?: string
    }
}

export interface CreateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

export interface GetUserRequest {
    cognitoId: string
}

export interface GetUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

export interface UpdateUserRequest {
    id: string
    fullName?: string
    avatarUrl?: string
    phoneNumber?: string
    address?: string
    bio?: string
}

export interface UpdateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

export interface UserExistsRequest {
    cognitoId: string
}

export interface UserExistsResponse {
    exists: boolean
    userId?: string
    error: string | null
}

export interface GetUserByEmailRequest {
    email: string
}

export interface GetUserByEmailResponse {
    success: boolean
    user: any | null
    error: string | null
}

export interface HealthResponse {
    status: string
    service: string
    timestamp: string
    uptime: number
}

export interface CreditAdminWalletRequest {
    adminId: string
    campaignId: string | null
    paymentTransactionId: string | null
    amount: string
    gateway: string
    description?: string
    sepayMetadata?: string
}

export interface CreditFundraiserWalletRequest {
    fundraiserId: string
    campaignId: string | null
    paymentTransactionId: string | null
    amount: string
    gateway: string
    description?: string
}

export interface CreditWalletResponse {
    success: boolean
    walletTransactionId?: string
    error?: string
}

export interface ProcessBankTransferOutRequest {
    sepayId: number
    amount: string // gRPC uses string for bigint
    gateway: string
    referenceCode: string
    content: string
    transactionDate: string
    description: string
}

export interface ProcessBankTransferOutResponse {
    success: boolean
    walletTransactionId?: string
    error?: string
}

export interface AwardBadgeRequest {
    userId: string
    badgeId: string
}

export interface AwardBadgeResponse {
    success: boolean
    userBadgeId?: string
    badge?: {
        id: string
        name: string
        description: string
        iconUrl: string
        sortOrder: number
        isActive: boolean
        createdAt: string
        updatedAt: string
    }
    error?: string
}

export interface GetUserBadgeRequest {
    userId: string
}

export interface GetUserBadgeResponse {
    success: boolean
    badge?: {
        id: string
        name: string
        description: string
        iconUrl: string
        sortOrder: number
        isActive: boolean
        createdAt: string
        updatedAt: string
    }
    awardedAt?: string
    error?: string
}

export interface UpdateDonorStatsRequest {
    donorId: string
    amountToAdd: string
    incrementCount: number
    lastDonationAt: string
}

export interface UpdateDonorStatsResponse {
    success: boolean
    totalDonated?: string
    donationCount?: number
    error?: string
}

export interface GetUserWithStatsRequest {
    id: string
}

export interface GetUserWithStatsResponse {
    success: boolean
    id?: string
    totalDonated?: string
    donationCount?: number
    lastDonationAt?: string
    error?: string
}

export interface GetWalletBalanceRequest {
    userId: string
}

export interface GetWalletBalanceResponse {
    success: boolean
    balance?: string
    error?: string
}

export interface DebitWalletRequest {
    userId: string
    campaignId: string
    amount: string
    description?: string
}

export interface DebitWalletResponse {
    success: boolean
    walletTransactionId?: string
    newBalance?: string
    error?: string
}

export interface GetUserBasicInfoRequest {
    userId: string
}

export interface GetUserBasicInfoResponse {
    success: boolean
    user?: {
        id: string
        role: string
        organizationId: string | null
        organizationName: string | null
    }
    error?: string
}

export interface GetUserOrganizationRequest {
    userId: string
}

export interface GetUserOrganizationResponse {
    success: boolean
    organization?: {
        id: string
        name: string
    }
    error?: string
}

export interface GetUsersByIdsRequest {
    userIds: string[]
}

export interface GetUsersByIdsResponse {
    success: boolean
    users: Array<{
        id: string
        fullName: string
        username: string
        avatarUrl: string
    }>
    error?: string
}

export interface GetUserDisplayNameRequest {
    userId: string
}

export interface GetUserDisplayNameResponse {
    success: boolean
    displayName: string
    error?: string
}

export interface GetWalletTransactionsByPaymentIdRequest {
    paymentTransactionId: string
}

export interface GetWalletTransactionsByPaymentIdResponse {
    success: boolean
    transactions?: Array<{
        id: string
        amount: string
        transactionType: string
        gateway: string | null
        reference: string | null
        description: string | null
        createdAt: string
    }>
    error?: string
}

export interface GetVerifiedOrganizationsRequest {}

export interface VerifiedOrganizationInfo {
    id: string
    name: string
    representativeId: string
    representativeName: string
    activityField: string
    address: string
    phoneNumber: string
    email: string
}

export interface GetVerifiedOrganizationsResponse {
    success: boolean
    organizations: VerifiedOrganizationInfo[]
    error?: string
}

export interface GetOrganizationByIdRequest {
    organizationId: string
}

export interface GetOrganizationByIdResponse {
    success: boolean
    organization?: {
        id: string
        name: string
        representativeId: string
    }
    error?: string
}