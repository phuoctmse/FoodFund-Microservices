import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonationService } from "../../services/donation.service"
import { CreateDonationInput } from "../../dtos/create-donation.input"
import { DonationResponse } from "../../dtos/donation-response.dto"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUserType, RequireRole } from "@libs/auth"
import { Role } from "@libs/databases"

@Resolver(() => DonationResponse)
export class DonationMutationResolver {
    constructor(private readonly donationService: DonationService) {}

    @Mutation(() => DonationResponse, {
        description: "Create a new donation for a campaign"
    })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.DONOR)
    async createDonation(
        @Args("input") input: CreateDonationInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<DonationResponse> {
        const donation = await this.donationService.createDonation(input, user.username)
        return {
            message: "Donation request has been queued for processing",
            donationId: donation.id
        }
    }
}