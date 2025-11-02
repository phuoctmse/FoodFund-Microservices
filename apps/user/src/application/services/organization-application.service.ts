import { Injectable, Logger, Inject, NotFoundException, BadRequestException } from "@nestjs/common"
import { AwsCognitoService } from "@libs/aws-cognito"
import { PrismaClient } from "../../generated/user-client"
import {
    IOrganizationRepository,
    IUserRepository,
    CreateOrganizationData,
} from "../../domain/interfaces"
import {
    OrganizationAlreadyExistsException,
    JoinRequestExistsException,
    OrganizationNotFoundException,
    UserNotFoundException,
} from "../../domain/exceptions"
import { Role, VerificationStatus } from "../../domain/enums"

/**
 * Application Service: Organization Management
 * Handles all organization-related business logic
 */
@Injectable()
export class OrganizationApplicationService {
    private readonly logger = new Logger(OrganizationApplicationService.name)

    constructor(
        @Inject("IOrganizationRepository")
        private readonly organizationRepository: IOrganizationRepository,
        @Inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly prisma: PrismaClient,
    ) {}

    // ========================================
    // ORGANIZATION CREATION & MANAGEMENT
    // ========================================

    /**
     * Request to create a new organization (Donor only)
     */
    async requestCreateOrganization(
        cognitoId: string,
        data: CreateOrganizationData,
    ) {
        // Validate user exists and is a DONOR
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            throw new BadRequestException(
                `Only DONOR users can create organizations. Current role: ${user.role}`,
            )
        }

        // Check if user already has a pending organization request
        const existingOrg =
            await this.organizationRepository.findOrganizationByRepresentativeId(
                user.id,
            )
        if (existingOrg && existingOrg.status === VerificationStatus.PENDING) {
            throw new OrganizationAlreadyExistsException(user.id)
        }

        try {
            return await this.organizationRepository.createOrganization(
                user.id,
                data,
            )
        } catch (error) {
            this.logger.error("Error creating organization:", error)
            throw new BadRequestException("Failed to create organization")
        }
    }

    /**
     * Get user's organization requests
     */
    async getUserOrganizations(cognitoId: string) {
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            return []
        }

        const organization =
            await this.organizationRepository.findOrganizationByRepresentativeId(
                user.id,
            )

        if (!organization) {
            return []
        }

        return [
            {
                ...organization,
                representative: organization.user,
            },
        ]
    }

    /**
     * Get all organization requests (Admin only)
     */
    async getAllOrganizationRequests(options?: {
        status?: string
        sortBy?: string
        sortOrder?: string
    }) {
        return this.organizationRepository.findAllOrganizations(options)
    }

    /**
     * Approve organization request (Admin only)
     * Uses Prisma Transaction + Saga pattern for Cognito sync
     */
    async approveOrganizationRequest(organizationId: string) {
        // Validation
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            throw new OrganizationNotFoundException(organizationId)
        }

        if (organization.status !== VerificationStatus.PENDING) {
            throw new BadRequestException(
                `Organization is not pending. Current status: ${organization.status}`,
            )
        }

        try {
            this.logger.log(
                `[TRANSACTION] Starting approval for organization: ${organizationId}`,
            )

            // Database Transaction
            const updatedOrganization = await this.prisma.$transaction(
                async (tx) => {
                    // Step 1: Update organization status
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

            // External Service - Cognito sync (outside transaction)
            if (organization.user.cognitoId) {
                this.logger.debug(
                    "[SAGA] Step 4: Updating Cognito custom:role attribute",
                )

                await this.updateCognitoRoleWithRetry(
                    organization.user.cognitoId,
                    Role.FUNDRAISER,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${organization.user.cognitoId}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Organization approval completed: ${organizationId}`,
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
     * Reject organization request (Admin only)
     */
    async rejectOrganizationRequest(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationById(
                organizationId,
            )
        if (!organization) {
            throw new OrganizationNotFoundException(organizationId)
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

    // ========================================
    // ORGANIZATION QUERIES
    // ========================================

    /**
     * Get fundraiser's organization with members
     */
    async getFundraiserOrganization(cognitoId: string) {
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        if (user.role !== Role.FUNDRAISER) {
            throw new BadRequestException(
                `Only FUNDRAISER users can access this. Current role: ${user.role}`,
            )
        }

        const organization =
            await this.organizationRepository.findOrganizationByRepresentativeId(
                user.id,
            )
        if (!organization) {
            throw new NotFoundException(
                "No active organization found for this fundraiser",
            )
        }

        // Transform for GraphQL response
        return {
            ...organization,
            representative: organization.user,
            members: organization.Organization_Member.map((member: any) => ({
                id: member.id,
                member: member.member,
                member_role: member.member_role,
                status: member.status,
                joined_at: member.joined_at,
            })),
            total_members: organization.Organization_Member.length,
            active_members: organization.Organization_Member.filter(
                (member: any) => member.status === VerificationStatus.VERIFIED,
            ).length,
        }
    }

    /**
     * Get active organizations with members (public)
     */
    async getActiveOrganizationsWithMembers(options: {
        offset: number
        limit: number
    }) {
        const result =
            await this.organizationRepository.findActiveOrganizationsWithMembersPaginated(
                options,
            )

        const mappedOrganizations = result.organizations.map((org: any) => ({
            ...org,
            members:
                org.Organization_Member?.map((member: any) => ({
                    id: member.id,
                    member: member.member,
                    member_role: member.member_role,
                    status: member.status,
                    joined_at: member.joined_at,
                })) || [],
            total_members: org.Organization_Member?.length || 0,
            active_members:
                org.Organization_Member?.filter(
                    (member: any) => member.status === "VERIFIED",
                ).length || 0,
            representative: org.user,
        }))

        return {
            organizations: mappedOrganizations,
            total: result.total,
        }
    }

    /**
     * Get organization by ID (public, verified only)
     */
    async getOrganizationById(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationWithMembers(
                organizationId,
            )

        if (!organization) {
            throw new OrganizationNotFoundException(organizationId)
        }

        if (organization.status !== VerificationStatus.VERIFIED) {
            throw new NotFoundException(
                "Organization not found or not yet verified",
            )
        }

        return {
            ...organization,
            members:
                organization.Organization_Member?.map((member: any) => ({
                    id: member.id,
                    member: member.member,
                    member_role: member.member_role,
                    status: member.status,
                    joined_at: member.joined_at,
                })) || [],
            total_members: organization.Organization_Member?.length || 0,
            active_members:
                organization.Organization_Member?.filter(
                    (member: any) =>
                        member.status === VerificationStatus.VERIFIED,
                ).length || 0,
            representative: organization.user,
        }
    }

    // ========================================
    // JOIN REQUEST MANAGEMENT
    // ========================================

    /**
     * Request to join organization (Donor only)
     */
    async requestJoinOrganization(
        cognitoId: string,
        data: { organization_id: string; requested_role: string },
    ) {
        // Convert role string to Role enum
        const roleForDatabase = this.convertJoinRoleToRole(data.requested_role)

        // Validate user
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            throw new BadRequestException(
                `Only DONOR users can join organizations. Current role: ${user.role}`,
            )
        }

        // Validate organization
        const organization =
            await this.organizationRepository.findOrganizationById(
                data.organization_id,
            )
        if (!organization) {
            throw new OrganizationNotFoundException(data.organization_id)
        }

        if (organization.status !== VerificationStatus.VERIFIED) {
            throw new BadRequestException("Organization is not verified")
        }

        // Check existing requests
        const existingRequest =
            await this.organizationRepository.checkExistingJoinRequestInAnyOrganization(
                user.id,
            )
        if (existingRequest) {
            throw new JoinRequestExistsException(user.id)
        }

        return this.organizationRepository.createJoinRequest(
            user.id,
            data.organization_id,
            roleForDatabase,
        )
    }

    /**
     * Get my join requests
     */
    async getMyJoinRequests(cognitoId: string) {
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            return []
        }
        return this.organizationRepository.findMyJoinRequests(user.id)
    }

    /**
     * Cancel join request (Donor only)
     */
    async cancelJoinRequest(cognitoId: string) {
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            throw new BadRequestException(
                `Only DONOR users can cancel join requests. Current role: ${user.role}`,
            )
        }

        const pendingRequest =
            await this.organizationRepository.findPendingJoinRequest(user.id)
        if (!pendingRequest) {
            throw new NotFoundException("No pending join request found")
        }

        if (pendingRequest.status !== VerificationStatus.PENDING) {
            throw new BadRequestException(
                `Join request cannot be cancelled. Current status: ${pendingRequest.status}`,
            )
        }

        await this.organizationRepository.deleteJoinRequest(pendingRequest.id)

        return {
            success: true,
            message: `Join request to "${pendingRequest.organization.name}" has been cancelled successfully.`,
            organizationName: pendingRequest.organization.name,
        }
    }

    /**
     * Get organization join requests (Fundraiser only)
     */
    async getMyOrganizationJoinRequests(
        fundraiserCognitoId: string,
        options?: { offset?: number; limit?: number; status?: string },
    ) {
        const fundraiserUser =
            await this.userRepository.findByCognitoId(fundraiserCognitoId)
        if (!fundraiserUser) {
            throw new UserNotFoundException(fundraiserCognitoId)
        }

        if (fundraiserUser.role !== Role.FUNDRAISER) {
            throw new BadRequestException(
                `Only FUNDRAISER users can access this. Current role: ${fundraiserUser.role}`,
            )
        }

        const organization =
            await this.organizationRepository.findOrganizationByRepresentativeId(
                fundraiserUser.id,
            )
        if (!organization) {
            throw new NotFoundException(
                "No organization found for this fundraiser",
            )
        }

        return this.organizationRepository.findJoinRequestsByOrganizationWithPagination(
            organization.id,
            {
                offset: options?.offset || 0,
                limit: options?.limit || 10,
                status: options?.status,
            },
        )
    }

    /**
     * Approve join request (Fundraiser only)
     * Uses Prisma Transaction + Saga pattern
     */
    async approveJoinRequest(requestId: string, fundraiserCognitoId: string) {
        // Validation
        const fundraiserUser =
            await this.userRepository.findByCognitoId(fundraiserCognitoId)
        if (!fundraiserUser) {
            throw new UserNotFoundException(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(requestId)
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

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
            this.logger.log(
                `[TRANSACTION] Starting approval for join request: ${requestId}`,
            )

            const updatedRequest = await this.prisma.$transaction(
                async (tx) => {
                    // Step 1: Update join request status
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

                    // Step 2: Update user role
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

            // Cognito sync
            if (joinRequest.member.cognitoId) {
                this.logger.debug(
                    "[SAGA] Step 3: Updating Cognito custom:role attribute",
                )

                await this.updateCognitoRoleWithRetry(
                    joinRequest.member.cognitoId,
                    joinRequest.member_role as Role,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${joinRequest.member.cognitoId}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Join request approval completed: ${requestId}`,
            )

            return updatedRequest
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Join request approval failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    /**
     * Reject join request (Fundraiser only)
     */
    async rejectJoinRequest(requestId: string, fundraiserCognitoId: string) {
        const fundraiserUser =
            await this.userRepository.findByCognitoId(fundraiserCognitoId)
        if (!fundraiserUser) {
            throw new UserNotFoundException(fundraiserCognitoId)
        }

        const joinRequest =
            await this.organizationRepository.findJoinRequestById(requestId)
        if (!joinRequest) {
            throw new NotFoundException("Join request not found")
        }

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

    // ========================================
    // STAFF MANAGEMENT
    // ========================================

    /**
     * Leave organization (Staff only)
     * Uses Prisma Transaction + Saga pattern
     */
    async leaveOrganization(cognitoId: string) {
        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        const staffRoles = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF]
        if (!staffRoles.includes(user.role as Role)) {
            throw new BadRequestException(
                "Only staff members (KITCHEN_STAFF, DELIVERY_STAFF) can leave organization",
            )
        }

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

            // Cognito sync
            if (user.cognitoId) {
                this.logger.debug(
                    "[SAGA] Step 3: Updating Cognito custom:role attribute back to DONOR",
                )

                await this.updateCognitoRoleWithRetry(
                    user.cognitoId,
                    Role.DONOR,
                )

                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${user.cognitoId}`,
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
     * Remove staff member (Fundraiser only)
     * Uses Prisma Transaction + Saga pattern
     */
    async removeStaffMember(memberId: string, fundraiserCognitoId: string) {
        const fundraiserUser =
            await this.userRepository.findByCognitoId(fundraiserCognitoId)
        if (!fundraiserUser) {
            throw new UserNotFoundException(fundraiserCognitoId)
        }

        if (fundraiserUser.role !== Role.FUNDRAISER) {
            throw new BadRequestException(
                `Only FUNDRAISER users can remove staff. Current role: ${fundraiserUser.role}`,
            )
        }

        const memberRecord =
            await this.organizationRepository.findJoinRequestById(memberId)
        if (!memberRecord) {
            throw new NotFoundException("Staff member not found")
        }

        if (
            memberRecord.organization.representative_id !== fundraiserUser.id
        ) {
            throw new BadRequestException(
                "You are not authorized to remove members from this organization",
            )
        }

        if (memberRecord.member_id === fundraiserUser.id) {
            throw new BadRequestException(
                "Cannot remove yourself from the organization",
            )
        }

        if (memberRecord.status !== VerificationStatus.VERIFIED) {
            throw new BadRequestException(
                "Can only remove verified members. Use reject for pending requests.",
            )
        }

        const removedMemberInfo = {
            id: memberRecord.member.id,
            name: memberRecord.member.full_name,
            email: memberRecord.member.email,
            role: memberRecord.member_role,
        }

        try {
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
                    where: { id: memberRecord.member_id },
                    data: { role: Role.DONOR },
                })

                this.logger.log(
                    "[TRANSACTION] Database operations completed successfully",
                )
            })

            if (memberRecord.member.cognitoId) {
                this.logger.debug(
                    "[SAGA] Step 3: Updating Cognito custom:role attribute back to DONOR",
                )
                await this.updateCognitoRoleWithRetry(
                    memberRecord.member.cognitoId,
                    Role.DONOR,
                )
                this.logger.log(
                    `[SAGA] Cognito role updated successfully for user: ${memberRecord.member.cognitoId}`,
                )
            }

            this.logger.log(
                `[TRANSACTION] Staff removal completed successfully: ${memberId}`,
            )

            return {
                success: true,
                message: `Successfully removed ${removedMemberInfo.name} from the organization. Their role has been changed back to DONOR.`,
                removedMemberId: removedMemberInfo.id,
                removedMemberName: removedMemberInfo.name,
                previousRole: removedMemberInfo.role,
            }
        } catch (error) {
            this.logger.error(
                `[TRANSACTION] Staff removal failed: ${error instanceof Error ? error.message : error}`,
            )
            throw error
        }
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Convert join role string to Role enum
     */
    private convertJoinRoleToRole(joinRole: string): Role {
        switch (joinRole) {
        case "KITCHEN_STAFF":
            return Role.KITCHEN_STAFF
        case "DELIVERY_STAFF":
            return Role.DELIVERY_STAFF
        default:
            throw new BadRequestException(`Invalid join role: ${joinRole}`)
        }
    }

    /**
     * Update Cognito role with retry mechanism
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
                return
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)

                if (attempt === maxRetries) {
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
}
