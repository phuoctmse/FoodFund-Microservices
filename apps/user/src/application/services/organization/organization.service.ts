import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"

import { PrismaClient } from "../../../generated/user-client"
import { AwsCognitoService } from "@libs/aws-cognito"

import {
    UserErrorHelper,
    DonorErrorHelper,
    AdminErrorHelper,
    FundraiserErrorHelper,
} from "../../../domain/exceptions"
import {
    OrganizationRepository,
    UserRepository,
    WalletRepository,
} from "../../repositories"
import { Role, VerificationStatus } from "@libs/databases"
import {
    JoinOrganizationRole,
    CreateOrganizationInput,
    JoinOrganizationInput,
} from "../../dtos"
import { DataLoaderService } from "../shared/dataloader.service"

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
        private readonly walletRepository: WalletRepository,
    ) { }


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

    /**
     * Normalize Vietnamese string for comparison
     * - Converts to uppercase
     * - Removes accents/diacritics
     * - Trims whitespace
     */
    private normalizeVietnameseName(name: string): string {
        if (!name) return ""

        return name
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/Đ/g, "D")
            .replace(/đ/g, "D")
    }

    async requestCreateOrganization(
        cognitoId: string,
        data: CreateOrganizationInput,
    ) {
        UserErrorHelper.validateRequiredString(cognitoId, "cognitoId")

        const user = await this.userRepository.findUserByCognitoId(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (data.bank_account_name && data.bank_account_name.trim() !== "") {
            const normalizedBankName = this.normalizeVietnameseName(data.bank_account_name)
            const normalizedRepName = this.normalizeVietnameseName(data.representative_name)

            if (normalizedBankName !== normalizedRepName) {
                DonorErrorHelper.throwOrganizationBankAccountMismatch()
            }
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotCreateOrganizationAsNonDonor(user.role)
        }

        const existingOrg = await this.userRepository.findUserOrganizationAnyStatus(
            user.id,
        )

        if (existingOrg) {
            if (existingOrg.status === VerificationStatus.VERIFIED) {
                throw new BadRequestException(
                    "You already have a verified organization. Each user can only create one organization.",
                )
            }

            if (existingOrg.status === VerificationStatus.PENDING) {
                throw new BadRequestException(
                    "You already have a pending organization request. Please wait for admin approval or cancel the existing request.",
                )
            }
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
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.FUNDRAISER) {
            UserErrorHelper.throwUnauthorizedRole(user.role, [Role.FUNDRAISER])
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

        const transformedOrganization = {
            ...organization,
            representative: organization.user,
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
            this.logger.log(
                `[TRANSACTION] Starting approval for organization: ${organizationId}`,
            )

            const updatedOrganization = await this.prisma.$transaction(
                async (tx) => {
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

                    this.logger.debug(
                        "[TRANSACTION] Step 2: Updating user role to FUNDRAISER",
                    )
                    await tx.user.update({
                        where: { id: organization.representative_id },
                        data: { role: Role.FUNDRAISER },
                    })

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

                    this.logger.debug(
                        "[TRANSACTION] Step 4: Creating FUNDRAISER wallet",
                    )
                    await tx.wallet.create({
                        data: {
                            user_id: organization.representative_id,
                            wallet_type: "FUNDRAISER",
                            balance: BigInt(0),
                        },
                    })

                    this.logger.log(
                        "[TRANSACTION] Database operations completed successfully",
                    )

                    return updatedOrg
                },
            )

            if (organization.user.cognito_id) {
                this.logger.debug(
                    "[SAGA] Step 5: Updating Cognito custom:role attribute",
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

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async rejectOrganizationRequest(organizationId: string, reason: string) {
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
            reason,
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

        return organizations.map((org) => ({
            ...org,
            representative: org.user,
        }))
    }

    async requestJoinOrganization(
        cognitoId: string,
        data: JoinOrganizationInput,
    ) {
        const roleForDatabase = this.convertJoinRoleToRole(data.requested_role)

        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotJoinAsNonDonor(user.role)
        }

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

        const organization = await this.userRepository.findUserOrganization(
            fundraiserUser.id,
        )
        if (!organization) {
            FundraiserErrorHelper.throwFundraiserHasNoOrganization(
                fundraiserUser.id,
            )
        }

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

    async approveJoinRequest(requestId: string, fundraiserCognitoId: string) {
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
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            return null
        }
        return this.organizationRepository.findMyJoinRequests(user.id)
    }

    async cancelJoinRequest(cognitoId: string) {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwCannotJoinAsNonDonor(user.role)
        }

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

        await this.organizationRepository.deleteJoinRequest(pendingRequest.id)

        return {
            success: true,
            message: `Join request to "${pendingRequest.organization.name}" has been cancelled successfully.`,
            cancelledRequestId: pendingRequest.id,
        }
    }

    async cancelOrganizationRequest(cognitoId: string, reason?: string) {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            throw new BadRequestException(
                "Only DONOR role can cancel organization requests.",
            )
        }

        const organizationRequest =
            await this.userRepository.findUserOrganizationAnyStatus(user.id)

        if (!organizationRequest) {
            throw new NotFoundException(
                "No organization request found to cancel.",
            )
        }

        if (organizationRequest.status === VerificationStatus.VERIFIED) {
            throw new BadRequestException(
                "Cannot cancel a verified organization. Please contact support if you need to deactivate your organization.",
            )
        }

        if (organizationRequest.status === VerificationStatus.CANCELLED) {
            throw new BadRequestException(
                "Organization request is already cancelled.",
            )
        }

        if (
            organizationRequest.status !== VerificationStatus.PENDING &&
            organizationRequest.status !== VerificationStatus.REJECTED
        ) {
            throw new BadRequestException(
                `Organization request with status ${organizationRequest.status} cannot be cancelled.`,
            )
        }

        const cancelledOrg = await this.organizationRepository.cancelOrganizationRequest(
            organizationRequest.id,
            reason,
        )

        return {
            success: true,
            message: `Organization request "${organizationRequest.name}" has been cancelled successfully.`,
            cancelledOrganizationId: cancelledOrg.id,
            previousStatus: organizationRequest.status,
            reason: cancelledOrg.reason,
        }
    }

    async getProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        return this.organizationDataLoader.getUserOrganization(user.id)
    }

    async getFundraiserProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

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
            representative: org.user,
        }))

        return {
            organizations: mappedOrganizations,
            total: result.total,
        }
    }

    async getOrganizationById(organizationId: string) {
        const organization =
            await this.organizationRepository.findOrganizationWithMembers(
                organizationId,
            )

        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        if (organization.status !== VerificationStatus.VERIFIED) {
            throw new NotFoundException(
                "Organization not found or not yet verified",
            )
        }

        return {
            ...organization,
            members:
                organization.Organization_Member?.map((member) => ({
                    id: member.id,
                    member: member.member,
                    member_role: member.member_role,
                    status: member.status,
                    joined_at: member.joined_at,
                    cognito_id: member.member.cognito_id,
                })) || [],
            total_members: organization.Organization_Member?.length || 0,
            active_members:
                organization.Organization_Member?.filter(
                    (member) => member.status === VerificationStatus.VERIFIED,
                ).length || 0,
            representative: organization.user,
        }
    }

    async leaveOrganization(cognitoId: string): Promise<{
        success: boolean
        message: string
        previousOrganization: {
            id: string
            name: string
        }
        previousRole: string
    }> {
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        const staffRoles: Role[] = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF]
        if (!staffRoles.includes(user.role as Role)) {
            throw new BadRequestException(
                "Only staff members (KITCHEN_STAFF, DELIVERY_STAFF) can leave organization. Fundraisers must transfer ownership first.",
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
                this.logger.debug(
                    "[TRANSACTION] Step 1: Removing user from organization",
                )
                await tx.organization_Member.delete({
                    where: { id: memberRecord.id },
                })

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
