import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { DonorProfileSchema, Role, OrganizationSchema } from "libs/databases/prisma/schemas"
import { UpdateDonorProfileInput } from "../../dto/profile.input"
import { CreateOrganizationInput, JoinOrganizationInput } from "../../dto/organization.input"
import { OrganizationActionResponse } from "../../types/organization-response.model"
import { JoinRequestResponse } from "../../types/join-request-response.model"
import { DonorService } from "../../services/donor/donor.service"
import { CurrentUser, RequireRole } from "libs/auth"
import { OrganizationService } from "../../services"
import { AwsCognitoModule, CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => DonorProfileSchema)
export class DonorProfileResolver {
    constructor(
        private readonly donorService: DonorService,
        private readonly organizationService: OrganizationService,
    ) {}

    @Mutation(() => DonorProfileSchema)
    @RequireRole(Role.DONOR)
    async updateDonorProfile(
        @CurrentUser() user: { cognito_id: string },
        @Args("updateDonorProfileInput", new ValidationPipe())
            updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        return this.donorService.updateProfile(user.cognito_id, updateDonorProfileInput)
    }

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.DONOR)
    async requestCreateOrganization(
        @CurrentUser() user: any,
        @Args("input") input: CreateOrganizationInput,
    ) {
        const result = await this.organizationService.requestCreateOrganization(user.id, input)
        return {
            organization: result,
            message: `Organization request "${result.name}" has been submitted successfully. Waiting for admin approval.`,
            success: true,
        }
    }

    @Query(() => OrganizationSchema, { nullable: true }) 
    @RequireRole(Role.DONOR, Role.FUNDRAISER)
    async myOrganizationRequest(@CurrentUser() user: any) {
        // Get user's organization request (pending, approved, or rejected)
        const result = await this.organizationService.getUserOrganization(user.id)
        return result || null
    }

    @Mutation(() => JoinRequestResponse)
    @RequireRole(Role.DONOR)
    async requestJoinOrganization(
        @CurrentUser() user: any,
        @Args("input") input: JoinOrganizationInput,
    ) {
        const result = await this.organizationService.requestJoinOrganization(user.id, input)
        
        let roleMessage = ""
        switch (input.requested_role) {
        case Role.KITCHEN_STAFF:
            roleMessage = "Kitchen Staff (food preparation)"
            break
        case Role.DELIVERY_STAFF:
            roleMessage = "Delivery Staff (food distribution)"
            break
        case Role.FUNDRAISER:
            roleMessage = "Fundraiser (campaign management)"
            break
        }
        
        return {
            id: result.id,
            organization: result.organization,
            requested_role: input.requested_role,
            status: result.status,
            message: `Join request to "${result.organization.name}" as ${roleMessage} has been submitted successfully. Waiting for approval.`,
            success: true,
        }
    }

    @Query(() => JoinRequestResponse, { nullable: true })
    @RequireRole(Role.DONOR)
    async myJoinRequest(@CurrentUser() user: any) {
        const result = await this.organizationService.getMyJoinRequests(user.id)
        if (!result) return null
        
        return {
            id: result.id,
            organization: result.organization,
            requested_role: "STAFF", // Default since we don't store this in DB yet
            status: result.status,
            message: `Your join request to "${result.organization.name}" is currently ${result.status.toLowerCase()}.`,
            success: true,
        }
    }
}