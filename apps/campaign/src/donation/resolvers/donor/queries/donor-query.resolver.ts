import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonorService } from "../../../services/donor.service"
import { Donation } from "../../../models/donation.model"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CampaignDonationsFilterInput } from "../../../dtos/campaign-donations-filter.input"

@Resolver(() => Donation)
export class DonorQueryResolver {
    constructor(private readonly donorService: DonorService) {}

    // @UseGuards(OptionalJwtAuthGuard)
    // @Query(() => CampaignDonationInfo, {
    //     description:
    //         "Get campaign donation info with dynamic QR code (DEPRECATED - use createDonation mutation instead)",
    //     deprecationReason:
    //         "Use createDonation mutation to generate PayOS payment link instead",
    // })
    // async getCampaignDonationInfo(
    //     @Args("campaignId", { type: () => String }) campaignId: string,
    //     @Args("isAnonymous", { type: () => Boolean, nullable: true })
    //         isAnonymous?: boolean,
    //     @CurrentUser() user: CurrentUserType | null = null,
    // ): Promise<CampaignDonationInfo> {
    //     return this.donorService.getCampaignDonationInfo(
    //         campaignId,
    //         user,
    //         isAnonymous,
    //     )
    // }

    @Query(() => Donation, {
        nullable: true,
        description: "Get a donation by ID",
    })
    async getDonation(
        @Args("id", { type: () => String }) id: string,
    ): Promise<Donation | null> {
        return this.donorService.getDonationById(id)
    }

    @Query(() => [Donation], {
        description: "Get donations for current user",
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
        description: "Get donations for a specific campaign",
    })
    async getCampaignDonations(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
        @Args("filter", {
            type: () => CampaignDonationsFilterInput,
            nullable: true,
        })
            filter?: CampaignDonationsFilterInput,
    ): Promise<Donation[]> {
        return this.donorService.getDonationsByCampaign(campaignId, {
            skip,
            take,
            filter,
        })
    }
}
