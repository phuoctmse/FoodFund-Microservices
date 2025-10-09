import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { FundraiserProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UpdateFundraiserProfileInput } from "../../dto/profile.input"
import { FundraiserService } from "../../services/fundraiser/fundraiser.service"
import { CurrentUser, RequireRole, CurrentUserType } from "libs/auth"
import { OrganizationService } from "../../services"
import { OrganizationWithMembers } from "../../types/organization-with-members.model"
import { JoinRequestManagementResponse, JoinRequestListResponse } from "../../types/join-request-management-response.model"

@Resolver(() => FundraiserProfileSchema)
export class FundraiserProfileResolver {
    constructor(
        private readonly fundraiserService: FundraiserService,
        private readonly organizationService: OrganizationService,
    ) {}

    // @Mutation(() => FundraiserProfileSchema)
    // @RequireRole(Role.FUNDRAISER)
    // async updateFundraiserProfile(
    //     @CurrentUser() user: { cognito_id: string },
    //     @Args("updateFundraiserProfileInput", new ValidationPipe())
    //         updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    // ) {
    //     return this.fundraiserService.updateProfile(
    //         user.cognito_id,
    //         updateFundraiserProfileInput,
    //     )
    // }
    @Query(() => OrganizationWithMembers, { 
        description: "Get the organization that this fundraiser manages with all members",
        nullable: true,
    })
    @RequireRole(Role.FUNDRAISER)
    async myOrganization(@CurrentUser() user: CurrentUserType) {
        console.debug("user:", user)
        return this.organizationService.getFundraiserOrganization(user.cognito_id)
    }

    @Query(() => JoinRequestListResponse)
    @RequireRole(Role.FUNDRAISER)
    async getOrganizationJoinRequests(
        @CurrentUser() user: CurrentUserType,
    ) {
        const requests = await this.organizationService.getMyOrganizationJoinRequests(user.cognito_id)
        return {
            success: true,
            message: `Found ${requests.length} join request(s) for your organization`,
            joinRequests: requests,
            total: requests.length,
        }
    }

    @Mutation(() => JoinRequestManagementResponse)
    @RequireRole(Role.FUNDRAISER)
    async approveJoinRequest(
        @CurrentUser() user: CurrentUserType,
        @Args("requestId") requestId: string,
    ) {
        const result = await this.organizationService.approveJoinRequest(requestId, user.cognito_id)
        return {
            success: true,
            message: `Join request approved successfully. User "${result.member.full_name}" is now a member.`,
            joinRequest: result,
            requestId: result.id,
        }
    }

    @Mutation(() => JoinRequestManagementResponse)
    @RequireRole(Role.FUNDRAISER)
    async rejectJoinRequest(
        @CurrentUser() user: CurrentUserType,
        @Args("requestId") requestId: string,
    ) {
        const result = await this.organizationService.rejectJoinRequest(requestId, user.cognito_id)
        return {
            success: true,
            message: "Join request rejected successfully.",
            joinRequest: result,
            requestId: result.id,
        }
    }

}