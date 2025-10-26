import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonorService } from "../../../services/donor.service"
import { Donation } from "../../../models/donation.model"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => Donation)
export class DonorQueryResolver {
    constructor(private readonly donorService: DonorService) {}

    @Query(() => Donation, {
        nullable: true,
        description: "Get a donation by ID"
    })
    async getDonation(
        @Args("id", { type: () => String }) id: string,
    ): Promise<Donation | null> {
        return this.donorService.getDonationById(id)
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
        return this.donorService.getDonationsByDonor(userId, { skip, take })
    }

    @Query(() => [Donation], {
        description: "Get donations for a specific campaign"
    })
    async getCampaignDonations(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ): Promise<Donation[]> {
        return this.donorService.getDonationsByCampaign(campaignId, { skip, take })
    }
}
