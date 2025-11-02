import { VerificationStatus, Role } from "../enums"

/**
 * Domain Interface: Organization Repository
 * Defines contract for organization data operations
 */
export interface IOrganizationRepository {
    // Organization CRUD
    createOrganization(
        representativeId: string,
        data: CreateOrganizationData,
    ): Promise<any>
    findOrganizationById(id: string): Promise<any | null>
    findOrganizationByRepresentativeId(
        representativeId: string,
    ): Promise<any | null>
    findOrganizationWithMembers(id: string): Promise<any | null>
    updateOrganizationStatus(
        id: string,
        status: VerificationStatus,
    ): Promise<any>

    // Organization Queries
    findPendingOrganizations(): Promise<any[]>
    findAllOrganizations(options?: OrganizationQueryOptions): Promise<any[]>
    findActiveOrganizationsWithMembersPaginated(options: {
        offset: number
        limit: number
    }): Promise<{ organizations: any[]; total: number }>

    // Organization Member Operations
    createJoinRequest(
        userId: string,
        organizationId: string,
        role: Role,
    ): Promise<any>
    findJoinRequestById(id: string): Promise<any | null>
    findJoinRequestsByOrganizationWithPagination(
        organizationId: string,
        options: PaginationOptions,
    ): Promise<{ joinRequests: any[]; total: number }>
    findMyJoinRequests(userId: string): Promise<any[]>
    findPendingJoinRequest(userId: string): Promise<any | null>
    findVerifiedMembershipByUserId(userId: string): Promise<any | null>
    updateJoinRequestStatus(
        id: string,
        status: VerificationStatus,
    ): Promise<any>
    deleteJoinRequest(id: string): Promise<void>

    // Validation Helpers
    checkExistingJoinRequestInAnyOrganization(
        userId: string,
    ): Promise<any | null>
}

/**
 * Data Transfer Objects for Repository
 */
export interface CreateOrganizationData {
    name: string
    activity_field: string
    address: string
    website?: string
    description: string
    representative_name: string
    representative_identity_number: string
    email: string
    phone_number: string
}

export interface OrganizationQueryOptions {
    status?: string
    sortBy?: string
    sortOrder?: string
}

export interface PaginationOptions {
    offset?: number
    limit?: number
    status?: string
}
