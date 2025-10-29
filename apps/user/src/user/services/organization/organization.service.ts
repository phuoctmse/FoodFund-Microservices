import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { OrganizationRepository } from "../../repositories/organization/organization.repository"
import { UserRepository } from "../../repositories/user.repository"
import {
    CreateOrganizationInput,
    JoinOrganizationInput,
} from "../../dto/organization.input"
import { JoinOrganizationRole } from "../../dto/join-organization-role.enum"
import { PrismaClient } from "../../../generated/user-client"
import { AwsCognitoService } from "@libs/aws-cognito"
import { DataLoaderService } from "../common"
import {
    UserErrorHelper,
    DonorErrorHelper,
    AdminErrorHelper,
    FundraiserErrorHelper,
} from "../../exceptions"
import { Role, VerificationStatus } from "../../enums/user.enum"
import { SagaOrchestrator } from "@libs/common"

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
    private readonly logger = new Logger(OrganizationService.name)

    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly userRepository: UserRepository,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly organizationDataLoader: DataLoaderService,
        private readonly prisma: PrismaClient,
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
        const existingOrg = await this.userRepository.findUserOrganization(
            user.id,
        )
        if (existingOrg && existingOrg.status === VerificationStatus.PENDING) {
            UserErrorHelper.throwPendingOrganizationRequest(cognitoId)
        }

        try {
            return await this.organizationRepository.createOrganization(
                user.id,
                data,
            )
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
        const organization =
            await this.organizationRepository.findOrganizationByRepresentativeId(
                user.id,
            )
        if (!organization) {
            throw new NotFoundException(
                "No active organization found for this fundraiser",
            )
        }

        // Transform data for GraphQL response
        const transformedOrganization = {
            ...organization,
            representative: organization.user, // Map user to representative for GraphQL
            members: organization.Organization_Member.map((member) => ({
                id: member.id,
                member: member.member,
                member_role: member.member_role,
                status: member.status,
                joined_at: member.joined_at,
            })),
            total_members: organization.Organization_Member.length,
            active_members: organization.Organization_Member.filter(
                (member) => member.status === VerificationStatus.VERIFIED,
            ).length,
        }

        return transformedOrganization
    }

    /**
     * Approve organization request with transaction
     * Uses Prisma Transaction for database operations + Saga pattern for Cognito sync
     */
    async approveOrganizationRequest(organizationId: string) {
        // ========================================
        // VALIDATION
        // ========================================
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            AdminErrorHelper.throwOrganizationRequestNotFound(organizationId)
        }

        if (organization.status !== VerificationStatus.PENDING) {
            AdminErrorHelper.throwOrganizationRequestNotPending(
                organizationId,
                organization.status,
            )
        }

        try {
            // ========================================
            // DATABASE TRANSACTION (Steps 1-3)
            // ========================================
            this.logger.log(
                `[TRANSACTION] Starting approval for organization: ${organizationId}`,
            )

            const updatedOrganization = await this.prisma.$transaction(
                async (tx) => {
                    // Step 1: Update organization status to VERIFIED
                    this.logger.debug(
                        "[TRANSACTION] Step 1: Updating organization status",
                    )
                    const updatedOrg = await tx.organization.update({
                        where: { id: organizationId },
                        data: { status: VerificationStatus.VERIFIED },
                        include: {
                            user: true,
                            Organization_Member: true,
                        },
                    })

                    // Step 2: Update user role to FUNDRAISER
                    this.logger.debug(
                        "[TRANSACTION] Step 2: Updating user role to FUNDRAISER",
                    )
                    await tx.user.update({
                        where: { id: organization.representative_id },
                        data: { role: Role.FUNDRAISER },
                    })

                    // Step 3: Create organization member with VERIFIED status
                    this.logger.debug(
                        "[TRANSACTION] Step 3: Creating organization member",
                    )
                    await tx.organization_Member.create({
                        data: {
                            organization_id: organizationId,
                            member_id: organization.representative_id,
                            member_role: Role.FUNDRAISER,
                            status: VerificationStatus.VERIFIED,
                        },
                    })

                    this.logger.log(
                        "[TRANSACTION] Database operations completed successfully",
                    )

                    return updatedOrg
                },
            )

            // ========================================
            // EXTERNAL SERVICE (Step 4) - Outside transaction
            // ========================================
            if (organization.user.cognito_id) {
                this.logger.debug(
                    "[SAGA] Step 4: Updating Cognito custom:role attribute",
                )

                await this.updateCognitoRoleWithRetry(
                    organization.user.cognito_id,
                    Role.FUNDRAISER,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${organization.user.cognito_id}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Organization approval completed successfully: ${organizationId}`,
            )

            return updatedOrganization
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Organization approval failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    /**
     * Update Cognito role with retry mechanism
     * Retries up to 3 times with exponential backoff
     */
    private async updateCognitoRoleWithRetry(
        cognitoId: string,
        role: Role,
        maxRetries = 3,
    ): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.awsCognitoService.updateUserAttributes(cognitoId, {
                    "custom:role": role,
                })
                return // Success
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)

                if (attempt === maxRetries) {
                    // Final attempt failed
                    this.logger.error(
                        `[SAGA] Failed to update Cognito role after ${maxRetries} attempts`,
                        {
                            cognitoId,
                            role,
                            error: errorMessage,
                            severity: "CRITICAL",
                            action: "MANUAL_COGNITO_UPDATE_REQUIRED",
                        },
                    )
                    throw new Error(
                        `Failed to sync role with Cognito after ${maxRetries} attempts: ${errorMessage}`,
                    )
                }

                // Wait before retry (exponential backoff)
                const delayMs = Math.pow(2, attempt) * 1000
                this.logger.warn(
                    `[SAGA] Cognito update attempt ${attempt} failed, retrying in ${delayMs}ms...`,
                )
                await this.delay(delayMs)
            }
        }
    }

    /**
     * Delay helper for retry mechanism
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async rejectOrganizationRequest(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        if (organization.status !== VerificationStatus.PENDING) {
            throw new BadRequestException(
                "Organization is not in pending status",
            )
        }

        return this.organizationRepository.updateOrganizationStatus(
            organizationId,
            VerificationStatus.REJECTED,
        )
    }

    async getUserOrganization(cognitoId: string) {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)
        if (!user) {
            return null
        }
        const organization = await this.userRepository.findUserOrganization(
            user.id,
        )

        if (!organization) {
            return null
        }

        return {
            ...organization,
            representative: organization.user,
        }
    }

    async getUserOrganizations(cognitoId: string) {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)
        if (!user) {
            return []
        }
        const organizations = await this.userRepository.findUserOrganizations(
            user.id,
        )

        // Map user field to representative field for GraphQL response
        return organizations.map((org) => ({
            ...org,
            representative: org.user,
        }))
    }

    async requestJoinOrganization(
        cognitoId: string,
        data: JoinOrganizationInput,
    ) {
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

        if (organization.status !== VerificationStatus.VERIFIED) {
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
        options?: PaginationOptions,
    ): Promise<PaginatedJoinRequestsResponse> {
        // Get the fundraiser user to get their database ID
        const fundraiserUser =
            await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        if (fundraiserUser.role !== Role.FUNDRAISER) {
            FundraiserErrorHelper.throwFundraiserOnlyOperation(
                "get organization join requests",
            )
        }

        // Find the organization where this user is the representative
        const organization = await this.userRepository.findUserOrganization(
            fundraiserUser.id,
        )
        if (!organization) {
            FundraiserErrorHelper.throwFundraiserHasNoOrganization(
                fundraiserUser.id,
            )
        }

        // Get join requests for this organization with pagination
        const result =
            await this.organizationRepository.findJoinRequestsByOrganizationWithPagination(
                organization!.id, // Use non-null assertion since we checked above
                {
                    offset: options?.offset || 0,
                    limit: options?.limit || 10,
                    status: options?.status,
                },
            )

        return result
    }

    /**
     * Approve join request with transaction
     * Uses Prisma Transaction for database operations + Saga pattern for Cognito sync
     */
    async approveJoinRequest(requestId: string, fundraiserCognitoId: string) {
        // ========================================
        // VALIDATION
        // ========================================
        const fundraiserUser =
            await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(requestId)
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

        // Verify authorization
        if (joinRequest.organization.representative_id !== fundraiserUser.id) {
            throw new BadRequestException(
                "You are not authorized to approve this request",
            )
        }

        if (joinRequest.status !== VerificationStatus.PENDING) {
            throw new BadRequestException(
                "Join request is not in pending status",
            )
        }

        try {
            // ========================================
            // DATABASE TRANSACTION (Steps 1-2)
            // ========================================
            this.logger.log(
                `[TRANSACTION] Starting approval for join request: ${requestId}`,
            )

            const updatedRequest = await this.prisma.$transaction(
                async (tx) => {
                    // Step 1: Update join request status to VERIFIED
                    this.logger.debug(
                        "[TRANSACTION] Step 1: Updating join request status",
                    )
                    const updatedJoinRequest =
                        await tx.organization_Member.update({
                            where: { id: requestId },
                            data: { status: VerificationStatus.VERIFIED },
                            include: {
                                member: true,
                                organization: true,
                            },
                        })

                    // Step 2: Update user role to the requested role
                    this.logger.debug(
                        `[TRANSACTION] Step 2: Updating user role to ${joinRequest.member_role}`,
                    )
                    await tx.user.update({
                        where: { id: joinRequest.member_id },
                        data: { role: joinRequest.member_role as Role },
                    })

                    this.logger.log(
                        "[TRANSACTION] Database operations completed successfully",
                    )

                    return updatedJoinRequest
                },
            )

            // ========================================
            // EXTERNAL SERVICE (Step 3) - Outside transaction
            // ========================================
            if (joinRequest.member.cognito_id) {
                this.logger.debug(
                    "[SAGA] Step 3: Updating Cognito custom:role attribute",
                )

                await this.updateCognitoRoleWithRetry(
                    joinRequest.member.cognito_id,
                    joinRequest.member_role as Role,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${joinRequest.member.cognito_id}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Join request approval completed successfully: ${requestId}`,
            )

            return updatedRequest
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Join request approval failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    async rejectJoinRequest(requestId: string, fundraiserCognitoId: string) {
        // Get the fundraiser user to get their database ID
        const fundraiserUser =
            await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(requestId)
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

        // Verify that the fundraiser is the representative of this organization
        if (joinRequest.organization.representative_id !== fundraiserUser.id) {
            throw new BadRequestException(
                "You are not authorized to reject this request",
            )
        }

        if (joinRequest.status !== VerificationStatus.PENDING) {
            throw new BadRequestException(
                "Join request is not in pending status",
            )
        }

        return this.organizationRepository.updateJoinRequestStatus(
            requestId,
            VerificationStatus.REJECTED,
        )
    }

    async getMyJoinRequests(cognitoId: string) {
        // Get all join requests made by the user
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            return null
        }
        return this.organizationRepository.findMyJoinRequests(user.id)
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
        const pendingRequest =
            await this.organizationRepository.findPendingJoinRequest(user.id)
        if (!pendingRequest) {
            DonorErrorHelper.throwNoJoinRequestToCancel(user.id)
        }

        if (pendingRequest.status !== VerificationStatus.PENDING) {
            DonorErrorHelper.throwJoinRequestNotCancellable(
                pendingRequest.id,
                pendingRequest.status,
            )
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
        const organization =
            await this.organizationDataLoader.getUserOrganization(user.id)
        if (!organization) {
            throw new NotFoundException("Organization not found for fundraiser")
        }

        return {
            organization: organization,
            user: user,
            role: Role.FUNDRAISER,
        }
    }

    async getActiveOrganizationsWithMembers(options: {
        offset: number
        limit: number
    }): Promise<PaginatedOrganizationsResponse> {
        const result =
            await this.organizationRepository.findActiveOrganizationsWithMembersPaginated(
                {
                    offset: options.offset,
                    limit: options.limit,
                },
            )

        // Map organizations to include required fields for GraphQL
        const mappedOrganizations = result.organizations.map((org) => ({
            ...org,
            members:
                org.Organization_Member?.map((member) => ({
                    id: member.id,
                    member: member.member,
                    member_role: member.member_role,
                    status: member.status,
                    joined_at: member.joined_at,
                })) || [],
            total_members: org.Organization_Member?.length || 0,
            active_members:
                org.Organization_Member?.filter(
                    (member) => member.status === "VERIFIED",
                ).length || 0,
            representative: org.user, // Map user to representative
        }))

        return {
            organizations: mappedOrganizations,
            total: result.total,
        }
    }

    /**
     * Get organization by ID (public access)
     * Only returns verified/active organizations
     */
    async getOrganizationById(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationWithMembers(
                organizationId,
            )

        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        // Only return verified organizations to public
        if (organization.status !== VerificationStatus.VERIFIED) {
            throw new NotFoundException(
                "Organization not found or not yet verified",
            )
        }

        // Map to include member counts and format for GraphQL
        return {
            ...organization,
            members:
                organization.Organization_Member?.map((member) => ({
                    id: member.id,
                    member: member.member,
                    member_role: member.member_role,
                    status: member.status,
                    joined_at: member.joined_at,
                })) || [],
            total_members: organization.Organization_Member?.length || 0,
            active_members:
                organization.Organization_Member?.filter(
                    (member) => member.status === VerificationStatus.VERIFIED,
                ).length || 0,
            representative: organization.user, // Map user to representative
        }
    }

    /**
     * Staff member leaves organization voluntarily (self-leave)
     * Uses Prisma Transaction for database operations + Saga pattern for Cognito sync
     */
    async leaveOrganization(cognitoId: string): Promise<{
        success: boolean
        message: string
        previousOrganization: {
            id: string
            name: string
        }
        previousRole: string
    }> {
        // ========================================
        // VALIDATION
        // ========================================
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        // Only staff members can leave (KITCHEN_STAFF, DELIVERY_STAFF)
        const staffRoles = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF]
        if (!staffRoles.includes(user.role as Role)) {
            throw new BadRequestException(
                "Only staff members (KITCHEN_STAFF, DELIVERY_STAFF) can leave organization. Fundraisers must transfer ownership first.",
            )
        }

        // Find user's organization membership
        const memberRecord =
            await this.organizationRepository.findVerifiedMembershipByUserId(
                user.id,
            )

        if (!memberRecord) {
            throw new NotFoundException(
                "You are not a member of any organization",
            )
        }

        const organizationInfo = {
            id: memberRecord.organization.id,
            name: memberRecord.organization.name,
        }
        const previousRole = user.role

        try {
            // ========================================
            // DATABASE TRANSACTION (Steps 1-2)
            // ========================================
            this.logger.log(
                `[TRANSACTION] Starting self-leave for user: ${user.id}`,
            )

            await this.prisma.$transaction(async (tx) => {
                // Step 1: Delete organization member record
                this.logger.debug(
                    "[TRANSACTION] Step 1: Removing user from organization",
                )
                await tx.organization_Member.delete({
                    where: { id: memberRecord.id },
                })

                // Step 2: Update user role back to DONOR
                this.logger.debug(
                    "[TRANSACTION] Step 2: Updating user role back to DONOR",
                )
                await tx.user.update({
                    where: { id: user.id },
                    data: { role: Role.DONOR },
                })

                this.logger.log(
                    "[TRANSACTION] Database operations completed successfully",
                )
            })

            // ========================================
            // EXTERNAL SERVICE (Step 3) - Outside transaction
            // ========================================
            if (user.cognito_id) {
                this.logger.debug(
                    "[SAGA] Step 3: Updating Cognito custom:role attribute back to DONOR",
                )

                await this.updateCognitoRoleWithRetry(
                    user.cognito_id,
                    Role.DONOR,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${user.cognito_id}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Self-leave completed successfully for user: ${user.id}`,
            )

            return {
                success: true,
                message: `You have successfully left "${organizationInfo.name}". Your role has been changed back to DONOR.`,
                previousOrganization: organizationInfo,
                previousRole,
            }
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Self-leave failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    /**
     * Remove staff member from organization with transaction
     * Uses Prisma Transaction for database operations + Saga pattern for Cognito sync
     */
    async removeStaffMember(
        memberId: string,
        fundraiserCognitoId: string,
    ): Promise<{
        success: boolean
        message: string
        removedMember: {
            id: string
            name: string
            email: string
            role: string
        }
    }> {
        const fundraiserUser =
            await this.validateFundraiserUser(fundraiserCognitoId)
        const memberRecord = await this.validateMemberRemoval(
            memberId,
            fundraiserUser.id,
        )

        const removedMemberInfo = {
            id: memberRecord.member.id,
            name: memberRecord.member.full_name,
            email: memberRecord.member.email,
            role: memberRecord.member_role,
        }

        try {
            await this.performMemberRemovalTransaction(
                memberId,
                memberRecord.member_id,
            )

            if (memberRecord.member.cognito_id) {
                await this.syncCognitoRoleForRemoval(
                    memberRecord.member.cognito_id,
                )
            }

            this.logger.log(
                `[TRANSACTION] Staff removal completed successfully: ${memberId}`,
            )

            return {
                success: true,
                message: `Successfully removed ${removedMemberInfo.name} from the organization. Their role has been changed back to DONOR.`,
                removedMember: removedMemberInfo,
            }
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Staff removal failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    private async validateFundraiserUser(fundraiserCognitoId: string) {
        const fundraiserUser =
            await this.userRepository.findUserById(fundraiserCognitoId)
        if (!fundraiserUser) {
            UserErrorHelper.throwUserNotFound(fundraiserCognitoId)
        }

        if (fundraiserUser.role !== Role.FUNDRAISER) {
            FundraiserErrorHelper.throwFundraiserOnlyOperation(
                "remove staff members",
            )
        }

        return fundraiserUser
    }

    private async validateMemberRemoval(
        memberId: string,
        fundraiserId: string,
    ) {
        const memberRecord =
            await this.organizationRepository.findJoinRequestById(memberId)
        if (!memberRecord) {
            throw new NotFoundException("Staff member not found")
        }

        if (memberRecord.organization.representative_id !== fundraiserId) {
            throw new BadRequestException(
                "You are not authorized to remove members from this organization",
            )
        }

        if (memberRecord.member_id === fundraiserId) {
            throw new BadRequestException(
                "Cannot remove yourself from the organization. Transfer ownership first.",
            )
        }

        if (memberRecord.status !== VerificationStatus.VERIFIED) {
            throw new BadRequestException(
                "Can only remove verified members. Use reject for pending requests.",
            )
        }

        return memberRecord
    }

    private async performMemberRemovalTransaction(
        memberId: string,
        memberUserId: string,
    ) {
        this.logger.log(
            `[TRANSACTION] Starting staff removal for member: ${memberId}`,
        )

        await this.prisma.$transaction(async (tx) => {
            this.logger.debug(
                "[TRANSACTION] Step 1: Removing member from organization",
            )
            await tx.organization_Member.delete({ where: { id: memberId } })

            this.logger.debug(
                "[TRANSACTION] Step 2: Updating user role back to DONOR",
            )
            await tx.user.update({
                where: { id: memberUserId },
                data: { role: Role.DONOR },
            })

            this.logger.log(
                "[TRANSACTION] Database operations completed successfully",
            )
        })
    }

    private async syncCognitoRoleForRemoval(cognitoId: string) {
        this.logger.debug(
            "[SAGA] Step 3: Updating Cognito custom:role attribute back to DONOR",
        )
        await this.updateCognitoRoleWithRetry(cognitoId, Role.DONOR)
        this.logger.log(
            `[SAGA] Cognito role updated successfully for user: ${cognitoId}`,
        )
    }
}
