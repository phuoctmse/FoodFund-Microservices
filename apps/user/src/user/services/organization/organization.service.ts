import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { OrganizationRepository } from "../../repositories/organization/organization.repository"
import { UserRepository } from "../../repositories/user.repository"
import { CreateOrganizationInput, JoinOrganizationInput } from "../../dto/organization.input"
import { Verification_Status } from "../../../generated/user-client"
import { Role } from "libs/databases/prisma/schemas"
import { AwsCognitoService } from "@libs/aws-cognito"
import { DataLoaderService } from "../common"
import { UserErrorHelper } from "../../exceptions"

@Injectable()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly userRepository: UserRepository,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly organizationDataLoader: DataLoaderService,
    ) {}

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
            UserErrorHelper.throwUnauthorizedRole(user.role, [Role.DONOR])
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

    async approveOrganizationRequest(organizationId: string) {
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
        // Validate requested role - now supports 3 roles
        UserErrorHelper.validateJoinOrganizationRole(data.requested_role)

        // Check if user exists and is a DONOR
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            UserErrorHelper.throwUserNotFound(cognitoId)
        }

        if (user.role !== Role.DONOR) {
            UserErrorHelper.throwUnauthorizedRole(user.role, [Role.DONOR])
        }

        // Check if organization exists and is verified
        const organization =
            await this.organizationRepository.findOrganizationById(
                data.organization_id,
            )
        if (!organization) {
            throw new NotFoundException("Organization not found")
        }

        if (organization.status !== Verification_Status.VERIFIED) {
            throw new BadRequestException("Organization is not verified")
        }

        // Check if user already has a join request or membership
        const existingRequest =
            await this.organizationRepository.checkExistingJoinRequest(
                user.id,
                data.organization_id,
            )
        if (existingRequest) {
            throw new BadRequestException(
                "User already has a request or membership with this organization",
            )
        }

        return this.organizationRepository.createJoinRequest(
            user.id,
            data.organization_id,
            data.requested_role,
        )
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
        return this.organizationRepository.findUserActiveOrganizationMembership(
            user.id,
        )
    }

    async getProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        // Use DataLoader to get user's organization with members
        return this.organizationDataLoader.getUserOrganization(user.id)
    }

    // Optimized method for KITCHEN_STAFF profile with organization data
    async getKitchenStaffProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        if (!user.Kitchen_Staff_Profile) {
            throw new NotFoundException("Kitchen staff profile not found")
        }

        // Get organization membership using DataLoader
        const memberships = await this.organizationDataLoader.getOrganizationMembersByUserId(user.id)
        const activeMembership = memberships.find(m => m.status === Verification_Status.VERIFIED)

        return {
            ...user.Kitchen_Staff_Profile,
            user: user,
            organization: activeMembership?.organization || null,
            organizationMembership: activeMembership || null,
        }
    }

    // Optimized method for DELIVERY_STAFF profile with organization data
    async getDeliveryStaffProfile(cognito_id: string) {
        const user = await this.userRepository.findUserByCognitoId(cognito_id)
        if (!user) {
            throw new NotFoundException("User not found")
        }

        if (!user.Delivery_Staff_Profile) {
            throw new NotFoundException("Delivery staff profile not found")
        }

        // Get organization membership using DataLoader
        const memberships = await this.organizationDataLoader.getOrganizationMembersByUserId(user.id)
        const activeMembership = memberships.find(m => m.status === Verification_Status.VERIFIED)

        return {
            ...user.Delivery_Staff_Profile,
            user: user,
            organization: activeMembership?.organization || null,
            organizationMembership: activeMembership || null,
        }
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
}
