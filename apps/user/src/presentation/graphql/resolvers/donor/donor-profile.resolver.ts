import { Resolver, Mutation, Args, Query } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"

import { CurrentUser, RequireRole, CurrentUserType } from "libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CreateOrganizationInput, JoinOrganizationInput, JoinOrganizationRole } from "@app/user/src/application/dtos"
import { DonorService, OrganizationService } from "@app/user/src/application/use-cases"
import { UserProfileSchema, OrganizationSchema } from "@app/user/src/domain/entities"
import { OrganizationActionResponse, JoinRequestResponse, CancelJoinRequestResponse } from "@app/user/src/shared/types"
import { Role } from "@libs/databases"


@Resolver(() => UserProfileSchema)
export class DonorProfileResolver {
    constructor(
        private readonly donorService: DonorService,
        private readonly organizationService: OrganizationService,
    ) {}

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.DONOR)
    async requestCreateOrganization(
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: CreateOrganizationInput,
    ) {
        const result = await this.organizationService.requestCreateOrganization(
            user.id,
            input,
        )

        // Map user field to representative field for GraphQL response
        const mappedResult = {
            ...result,
            representative: result.user,
        }

        return {
            organization: mappedResult,
            message: `Organization request "${result.name}" has been submitted successfully. Waiting for admin approval.`,
            success: true,
        }
    }

    @Query(() => [OrganizationSchema], { nullable: true })
    @RequireRole(Role.DONOR, Role.FUNDRAISER)
    async myOrganizationRequest(@CurrentUser() user: CurrentUserType) {
        // Try multiple sources for cognito_id
        const cognito_id = user.cognito_id || user.sub || user.id

        if (!cognito_id) {
            throw new Error("User cognito_id not found")
        }

        const result =
            await this.organizationService.getUserOrganizations(cognito_id)
        return result || []
    }

    @Mutation(() => JoinRequestResponse)
    @RequireRole(Role.DONOR)
    async requestJoinOrganization(
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: JoinOrganizationInput,
    ) {
        const result = await this.organizationService.requestJoinOrganization(
            user.cognito_id,
            input,
        )

        let roleMessage = ""
        switch (input.requested_role) {
        case JoinOrganizationRole.KITCHEN_STAFF:
            roleMessage = "Kitchen Staff (food preparation)"
            break
        case JoinOrganizationRole.DELIVERY_STAFF:
            roleMessage = "Delivery Staff (food distribution)"
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

    @Query(() => [JoinRequestResponse], { nullable: true })
    @RequireRole(Role.DONOR, Role.DELIVERY_STAFF, Role.KITCHEN_STAFF)
    async myJoinRequest(@CurrentUser() user: CurrentUserType) {
        const results = await this.organizationService.getMyJoinRequests(
            user.cognito_id,
        )
        if (!results || results.length === 0) return []

        return results.map((result) => ({
            id: result.id,
            organization: result.organization,
            requested_role: result.member_role,
            status: result.status,
            message: `Your join request to "${result.organization.name}" is currently ${result.status.toLowerCase()}.`,
            success: true,
        }))
    }

    @Mutation(() => CancelJoinRequestResponse)
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.DONOR)
    async cancelJoinRequestOrganization(@CurrentUser() user: CurrentUserType) {
        return this.organizationService.cancelJoinRequest(user.cognito_id)
    }
}
