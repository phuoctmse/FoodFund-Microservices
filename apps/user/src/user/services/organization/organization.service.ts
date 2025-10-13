import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { OrganizationRepository } from "../../repositories/organization/organization.repository"
import { UserRepository } from "../../repositories/user.repository"
import { CreateOrganizationInput, JoinOrganizationInput } from "../../dto/organization.input"
import { JoinOrganizationRole } from "../../dto/join-organization-role.enum"
import { Verification_Status } from "../../../generated/user-client"
import { Role } from "libs/databases/prisma/schemas"
import { AwsCognitoService } from "@libs/aws-cognito"
import { DataLoaderService } from "../common"
import { 
    UserErrorHelper, 
    DonorErrorHelper, 
    AdminErrorHelper, 
    FundraiserErrorHelper 
} from "../../exceptions"

// Interface for pagination options
interface PaginationOptions {
    offset?: number
    limit?: number
    status?: string
}

// Interface for paginated join requests response
interface PaginatedJoinRequestsResponse {
    joinRequests: any[]
    total: number
}

// Interface for paginated organizations response
interface PaginatedOrganizationsResponse {
    organizations: any[]
    total: number
}

@Injectable()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly userRepository: UserRepository,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly organizationDataLoader: DataLoaderService,
    ) {}

    /**
     * Convert JoinOrganizationRole to Role enum for database storage
     */
    private convertJoinRoleToRole(joinRole: JoinOrganizationRole): Role {
        switch (joinRole) {
        case JoinOrganizationRole.KITCHEN_STAFF:
            return Role.KITCHEN_STAFF
        case JoinOrganizationRole.DELIVERY_STAFF:
            return Role.DELIVERY_STAFF
        default:
            throw new BadRequestException(`Invalid join role: ${joinRole}`)
        }
    }

    async requestCreateOrganization(
        cognitoId: string,
        data: CreateOrganizationInput,
    ) {
        // Validate user exists and has correct role
        UserErrorHelper.validateRequiredString(cognitoId, "cognitoId")
        
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotCreateOrganizationAsNonDonor(user.role)
        }

        // Check if user already has an organization request
        const existingOrg = await this.userRepository.findUserOrganization(user.id)
        const hasPendingOrg = Array.isArray(existingOrg)
            ? existingOrg.some(org => (org as any)?.status === Verification_Status.PENDING)
            : (existingOrg as any)?.status === Verification_Status.PENDING
        if (hasPendingOrg) {
            UserErrorHelper.throwPendingOrganizationRequest(cognitoId)
        }

        console.log("Creating organization with representative_id:", user.id)

        try {
            return await this.organizationRepository.createOrganization(user.id, data)
        } catch (error) {
            console.error("Error creating organization:", error)
            UserErrorHelper.handlePrismaError(error, "createOrganization")
        }
    }

    async getPendingOrganizationRequests() {
        return this.organizationRepository.findPendingOrganizations()
    }

    async getAllOrganizationRequests(options?: {
        status?: string
        sortBy?: string
        sortOrder?: string
    }) {
        return this.organizationRepository.findAllOrganizations(options)
    }

    async getFundraiserOrganization(cognitoId: string) {
        // Get user by cognito ID
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.FUNDRAISER) {
            UserErrorHelper.throwUnauthorizedRole(user.role, [Role.FUNDRAISER])
        }

        // Get organization where user is the representative
        const organization = await this.organizationRepository.findOrganizationByRepresentativeId(user.id)
        if (!organization) {
            throw new NotFoundException("No active organization found for this fundraiser")
        }

        // Transform data for GraphQL response
        const transformedOrganization = {
            ...organization,
            members: organization.Organization_Member.map(member => ({
                id: member.id,
                member: member.member,
                member_role: member.member_role,
                status: member.status,
                joined_at: member.joined_at,
            })),
            total_members: organization.Organization_Member.length,
            active_members: organization.Organization_Member.filter(
                member => member.status === Verification_Status.VERIFIED
            ).length,
        }

        return transformedOrganization
    }

    async approveOrganizationRequest(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            AdminErrorHelper.throwOrganizationRequestNotFound(organizationId)
        }

        if (organization.status !== Verification_Status.PENDING) {
            AdminErrorHelper.throwOrganizationRequestNotPending(
                organizationId, 
                organization.status
            )
        }

        // Update organization status to VERIFIED
        const updatedOrganization =
            await this.organizationRepository.updateOrganizationStatus(
                organizationId,
                Verification_Status.VERIFIED,
            )

        // Update user role to FUNDRAISER
        await this.userRepository.updateUserRole(
            organization.representative_id,
            Role.FUNDRAISER,
        )

        // Add the organization creator to Organization_Member table as FUNDRAISER
        // Create directly with VERIFIED status since they are the organization owner
        await this.organizationRepository.createVerifiedMember(
            organization.representative_id,
            organizationId,
            Role.FUNDRAISER,
        )

        // Update AWS Cognito custom:role attribute
        if (organization.user.cognito_id) {
            await this.awsCognitoService.updateUserAttributes(
                organization.user.cognito_id,
                {
                    "custom:role": Role.FUNDRAISER,
                }
            )
        }

        return updatedOrganization
    }

    async rejectOrganizationRequest(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        if (organization.status !== Verification_Status.PENDING) {
            throw new BadRequestException(
                "Organization is not in pending status",
            )
        }

        return this.organizationRepository.updateOrganizationStatus(
            organizationId,
            Verification_Status.REJECTED,
        )
    }

    async getUserOrganization(cognitoId: string) {
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            return null
        }
        return this.userRepository.findUserOrganization(user.id)
    }

    async requestJoinOrganization(cognitoId: string, data: JoinOrganizationInput) {
        // Convert JoinOrganizationRole to Role for validation and storage
        const roleForDatabase = this.convertJoinRoleToRole(data.requested_role)

        // Check if user exists and is a DONOR
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotJoinAsNonDonor(user.role)
        }

        // Check if organization exists and is verified
        const organization =
            await this.organizationRepository.findOrganizationById(
                data.organization_id,
            )
        if (!organization) {
            UserErrorHelper.throwOrganizationNotFound(data.organization_id)
        }

        if (organization.status !== Verification_Status.VERIFIED) {
            throw new BadRequestException("Organization is not verified")
        }

        // Check if user already has any join request or membership in any organization
        const existingRequest =
            await this.organizationRepository.checkExistingJoinRequestInAnyOrganization(
                user.id,
            )
        if (existingRequest) {
            throw new BadRequestException(
                "User already has a pending request or membership with another organization. Please wait for the current request to be processed or leave your current organization before joining a new one.",
            )
        }

        return this.organizationRepository.createJoinRequest(
            user.id,
            data.organization_id,
            roleForDatabase,
        )
    }

    async getMyOrganizationJoinRequests(
        fundraiserCognitoId: string,
        options?: PaginationOptions
    ): Promise<PaginatedJoinRequestsResponse> {
        // Get the fundraiser user to get their database ID
        const fundraiserUser = await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        if (fundraiserUser.role !== Role.FUNDRAISER) {
            FundraiserErrorHelper.throwFundraiserOnlyOperation("get organization join requests")
        }

        // Find the organization where this user is the representative
        const organization = await this.userRepository.findUserOrganization(fundraiserUser.id)
        if (!organization) {
            FundraiserErrorHelper.throwFundraiserHasNoOrganization(fundraiserUser.id)
        }

        // Get join requests for this organization with pagination
        const result = await this.organizationRepository.findJoinRequestsByOrganizationWithPagination(
            organization.id,
            {
                offset: options?.offset || 0,
                limit: options?.limit || 10,
                status: options?.status,
            }
        )
        
        return result
    }

    async getOrganizationJoinRequests(
        organizationId: string,
        fundraiserCognitoId: string,
    ) {
        // Get the fundraiser user to get their database ID
        const fundraiserUser = await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        // Verify that the fundraiser is the representative of this organization
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        if (organization.representative_id !== fundraiserUser.id) {
            throw new BadRequestException(
                "You are not authorized to view requests for this organization",
            )
        }

        return this.organizationRepository.findPendingJoinRequestsByOrganization(
            organizationId,
        )
    }

    async approveJoinRequest(requestId: string, fundraiserCognitoId: string) {
        // Get the fundraiser user to get their database ID
        const fundraiserUser = await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(
                requestId,
            )
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

        // Verify that the fundraiser is the representative of this organization
        if (joinRequest.organization.representative_id !== fundraiserUser.id) {
            throw new BadRequestException(
                "You are not authorized to approve this request",
            )
        }

        if (joinRequest.status !== Verification_Status.PENDING) {
            throw new BadRequestException(
                "Join request is not in pending status",
            )
        }

        // Update join request status to VERIFIED
        const updatedRequest =
            await this.organizationRepository.updateJoinRequestStatus(
                requestId,
                Verification_Status.VERIFIED,
            )

        // Update user role to the requested role
        await this.userRepository.updateUserRole(
            joinRequest.member_id,
            joinRequest.member_role as Role,
        )

        // Update AWS Cognito custom:role attribute
        if (joinRequest.member.cognito_id) {
            await this.awsCognitoService.updateUserAttributes(
                joinRequest.member.cognito_id,
                {
                    "custom:role": joinRequest.member_role,
                }
            )
        }

        return updatedRequest
    }

    async rejectJoinRequest(requestId: string, fundraiserCognitoId: string) {
        // Get the fundraiser user to get their database ID
        const fundraiserUser = await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(
                requestId,
            )
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

        // Verify that the fundraiser is the representative of this organization
        if (joinRequest.organization.representative_id !== fundraiserUser.id) {
            throw new BadRequestException(
                "You are not authorized to reject this request",
            )
        }

        if (joinRequest.status !== Verification_Status.PENDING) {
            throw new BadRequestException(
                "Join request is not in pending status",
            )
        }

        return this.organizationRepository.updateJoinRequestStatus(
            requestId,
            Verification_Status.REJECTED,
        )
    }

    async getMyJoinRequests(cognitoId: string) {
        // Get all join requests made by the user
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            return null
        }
        return this.organizationRepository.findPendingJoinRequest(
            user.id,
        )
    }

    async cancelJoinRequest(cognitoId: string) {
        // Get user by cognito ID
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotJoinAsNonDonor(user.role)
        }

        // Find user's pending join request
        const pendingRequest = await this.organizationRepository.findPendingJoinRequest(user.id)
        if (!pendingRequest) {
            DonorErrorHelper.throwNoJoinRequestToCancel(user.id)
        }

        if (pendingRequest.status !== Verification_Status.PENDING) {
            DonorErrorHelper.throwJoinRequestNotCancellable(pendingRequest.id, pendingRequest.status)
        }

        // Delete the join request
        await this.organizationRepository.deleteJoinRequest(pendingRequest.id)

        return {
            success: true,
            message: `Join request to "${pendingRequest.organization.name}" has been cancelled successfully.`,
            cancelledRequestId: pendingRequest.id,
        }
    }

    async getProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        // Use DataLoader to get user's organization with members
        return this.organizationDataLoader.getUserOrganization(user.id)
    }

    // Optimized method for FUNDRAISER profile with organization data
    async getFundraiserProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        // Use DataLoader to get user's organization with all members
        const organization = await this.organizationDataLoader.getUserOrganization(user.id)
        if (!organization) {
            throw new NotFoundException("Organization not found for fundraiser")
        }

        return {
            organization: organization,
            user: user,
            role: Role.FUNDRAISER,
        }
    }

    async getActiveOrganizationsWithMembers(
        options: { offset: number; limit: number }
    ): Promise<PaginatedOrganizationsResponse> {
        const result = await this.organizationRepository.findActiveOrganizationsWithMembersPaginated({
            offset: options.offset,
            limit: options.limit,
        })

        return result
    }
}
