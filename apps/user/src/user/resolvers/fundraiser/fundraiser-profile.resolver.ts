import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { FundraiserProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UpdateFundraiserProfileInput } from "../../dto/profile.input"
import { FundraiserService } from "../../services/fundraiser/fundraiser.service"
import { CurrentUser, RequireRole } from "libs/auth"

@Resolver(() => FundraiserProfileSchema)
export class FundraiserProfileResolver {
    constructor(private readonly fundraiserService: FundraiserService) {}

    @Mutation(() => FundraiserProfileSchema)
    @RequireRole(Role.FUNDRAISER)
    async updateFundraiserProfile(
        @CurrentUser() user: { cognito_id: string },
        @Args("updateFundraiserProfileInput", new ValidationPipe())
            updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    ) {
        return this.fundraiserService.updateProfile(
            user.cognito_id,
            updateFundraiserProfileInput,
        )
    }

    // Individual role profile queries replaced by common getMyRoleProfile in UserQueryResolver
    // @Query(() => FundraiserProfileSchema)
    // @RequireRole(Role.FUNDRAISER)
    // async getFundraiserProfile(@CurrentUser() user: { cognito_id: string }) {
    //     return this.fundraiserService.getProfile(user.cognito_id)
    // }

    // Delete functionality removed - not part of business requirements
    // @Mutation(() => FundraiserProfileSchema)
    // async deleteFundraiserProfile(@Args("id", { type: () => ID }) id: string) {
    //     return this.fundraiserService.deleteFundraiserProfile(id)
    // }
}