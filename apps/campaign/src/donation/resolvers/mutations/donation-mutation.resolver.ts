import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonationService } from "../../donation.service"
import { CreateDonationInput } from "../../dtos/create-donation.input"
import { Donation } from "../../models/donation.model"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUserType } from "@libs/auth"

@Resolver(() => Donation)
export class DonationMutationResolver {
    constructor(private readonly donationService: DonationService) {}

    @Mutation(() => Donation, {
        description: "Create a new donation for a campaign"
    })
    @UseGuards(CognitoGraphQLGuard)
    async createDonation(
        @Args("input") input: CreateDonationInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<Donation> {
        return this.donationService.createDonation(input, user.cognito_id)
    }
}