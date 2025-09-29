import { Resolver, Mutation, Args, ID, Query } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { DonorProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UpdateDonorProfileInput } from "../../dto/profile.input"
import { DonorService } from "../../services/donor/donor.service"
import { CurrentUser, RequireRole } from "libs/auth"

@Resolver(() => DonorProfileSchema)
export class DonorProfileResolver {
    constructor(private readonly donorService: DonorService) {}

    @Mutation(() => DonorProfileSchema)
    @RequireRole(Role.DONOR)
    async updateDonorProfile(
        @CurrentUser() user: { cognito_id: string },
        @Args("updateDonorProfileInput", new ValidationPipe())
            updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        return this.donorService.updateProfile(user.cognito_id, updateDonorProfileInput)
    }

    // Individual role profile queries replaced by common getMyRoleProfile in UserQueryResolver
    // @Query(() => DonorProfileSchema)
    // @RequireRole(Role.DONOR)
    // async getDonorProfile(@CurrentUser() user: { cognito_id: string }) {
    //     return this.donorService.getProfile(user.cognito_id)
    // }

    // Delete functionality removed - not part of business requirements
    // @Mutation(() => DonorProfileSchema)
    // async deleteDonorProfile(@Args("id", { type: () => ID }) id: string) {
    //     return this.donorService.deleteDonorProfile(id)
    // }
}