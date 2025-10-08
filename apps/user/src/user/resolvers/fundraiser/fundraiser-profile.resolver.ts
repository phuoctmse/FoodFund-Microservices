import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { FundraiserProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UpdateFundraiserProfileInput } from "../../dto/profile.input"
import { FundraiserService } from "../../services/fundraiser/fundraiser.service"
import { CurrentUser, RequireRole } from "libs/auth"
import { OrganizationService } from "../../services"

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
    @Query(() => [String])
    @RequireRole(Role.FUNDRAISER)
    async getOrganizationJoinRequests(
        @CurrentUser() user: any,
        @Args("organizationId") organizationId: string,
    ) {
        const requests = await this.organizationService.getOrganizationJoinRequests(organizationId, user.id)
        return requests.map(req => req.id)
    }

    @Mutation(() => String)
    @RequireRole(Role.FUNDRAISER)
    async approveJoinRequest(
        @CurrentUser() user: any,
        @Args("requestId") requestId: string,
    ) {
        const result = await this.organizationService.approveJoinRequest(requestId, user.id)
        return result.id
    }

    @Mutation(() => String)
    @RequireRole(Role.FUNDRAISER)
    async rejectJoinRequest(
        @CurrentUser() user: any,
        @Args("requestId") requestId: string,
    ) {
        const result = await this.organizationService.rejectJoinRequest(requestId, user.id)
        return result.id
    }

}