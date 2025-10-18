import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonationService } from "../../services/donation.service"
import { Donation } from "../../models/donation.model"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => Donation)
export class DonationQueryResolver {
    constructor(private readonly donationService: DonationService) {}

    @Query(() => Donation, {
        nullable: true,
        description: "Get a donation by ID"
    })
    async getDonation(
        @Args("id", { type: () => String }) id: string,
    ): Promise<Donation | null> {
        return this.donationService.getDonationById(id)
    }

    @Query(() => [Donation], {
        description: "Get donations for current user"
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDonations(
        @CurrentUser("sub") userId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ): Promise<Donation[]> {
        return this.donationService.getDonationsByDonor(userId, { skip, take })
    }

    @Query(() => [Donation], {
        description: "Get donations for a specific campaign"
    })
    async getCampaignDonations(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ): Promise<Donation[]> {
        return this.donationService.getDonationsByCampaign(campaignId, { skip, take })
    }
}
