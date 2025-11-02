import { Resolver, Mutation, Args, Query } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, RequireRole, CurrentUserType } from "libs/auth"
import { Role } from "../../../domain/enums"
import { OrganizationApplicationService } from "../../../application/services"
import { UserModel } from "../models"
import {
    CreateOrganizationInput,
    JoinOrganizationInput,
    JoinOrganizationRole,
} from "../inputs"
import {
    OrganizationActionResponse,
    JoinRequestResponse,
    CancelJoinRequestResponse,
    OrganizationModel,
} from "../models"

/**
 * Presentation Resolver: Donor Profile
 * Handles GraphQL operations for donor-specific features
 */
@Resolver(() => UserModel)
export class UserDonorResolver {
    constructor(
        private readonly organizationApplicationService: OrganizationApplicationService,
    ) {}

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.DONOR)
    async requestCreateOrganization(
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: CreateOrganizationInput,
    ) {
        const result =
            await this.organizationApplicationService.requestCreateOrganization(
                user.cognito_id,
                input,
            )

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

    @Query(() => [OrganizationModel], { nullable: true })
    @RequireRole(Role.DONOR, Role.FUNDRAISER)
    async myOrganizationRequest(@CurrentUser() user: CurrentUserType) {
        const result =
            await this.organizationApplicationService.getUserOrganizations(
                user.cognito_id,
            )
        return result || []
    }

    @Mutation(() => JoinRequestResponse)
    @RequireRole(Role.DONOR)
    async requestJoinOrganization(
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: JoinOrganizationInput,
    ) {
        const result =
            await this.organizationApplicationService.requestJoinOrganization(
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
        const results =
            await this.organizationApplicationService.getMyJoinRequests(
                user.cognito_id,
            )
        if (!results || results.length === 0) return []

        return results.map((result: any) => ({
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
        return this.organizationApplicationService.cancelJoinRequest(
            user.cognito_id,
        )
    }
}
