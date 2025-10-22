import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonorService } from "../../../services/donor.service"
import { CreateDonationInput } from "../../../dtos/create-donation.input"
import { DonationResponse } from "../../../dtos/donation-response.dto"
import { CurrentUserType } from "@libs/auth"
import { OptionalJwtAuthGuard } from "@libs/auth/guards/optional-jwt-auth.guard"

@Resolver(() => DonationResponse)
export class DonorMutationResolver {
    constructor(private readonly donorService: DonorService) {}

    @UseGuards(OptionalJwtAuthGuard)
    @Mutation(() => DonationResponse, {
        description: "Create a new donation for a campaign"
    })
    async createDonation(
        @Args("input") input: CreateDonationInput,
        @CurrentUser() user: CurrentUserType | null = null,
    ): Promise<DonationResponse> {
        return this.donorService.createDonation(input, user)
    }
}