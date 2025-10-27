import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonorService } from "../../../services/donor.service"
import { Donation } from "../../../models/donation.model"
import { CampaignDonationInfo } from "../../../dtos/campaign-donation-info.dto"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUserType } from "@libs/auth"
import { OptionalJwtAuthGuard } from "@libs/auth/guards/optional-jwt-auth.guard"

@Resolver(() => Donation)
export class DonorQueryResolver {
    constructor(private readonly donorService: DonorService) {}

    @UseGuards(OptionalJwtAuthGuard)
    @Query(() => CampaignDonationInfo, {
        description:
            "Get campaign donation info with dynamic QR code (includes userId if authenticated and not anonymous)",
    })
    async getCampaignDonationInfo(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("isAnonymous", { type: () => Boolean, nullable: true })
            isAnonymous?: boolean,
        @CurrentUser() user: CurrentUserType | null = null,
    ): Promise<CampaignDonationInfo> {
        return this.donorService.getCampaignDonationInfo(
            campaignId,
            user,
            isAnonymous,
        )
    }

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
    ): Promise<Donation[]> {
        return this.donorService.getDonationsByCampaign(campaignId, {
            skip,
            take,
        })
    }
}
