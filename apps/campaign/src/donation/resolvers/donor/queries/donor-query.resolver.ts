import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { DonorService } from "../../../services/donor.service"
import { Donation } from "../../../models/donation.model"
import {
    MyDonationsResponse,
    DonationPaymentLinkResponse,
    DonationSortField,
    SortOrder,
} from "../../../dtos"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

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

    @Query(() => MyDonationsResponse, {
        description: "Get donations for current user",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDonations(
        @CurrentUser("sub") userId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ): Promise<MyDonationsResponse> {
        return this.donorService.getMyDonationsWithTotal(userId, { skip, take })
    }

    @Query(() => DonationPaymentLinkResponse, {
        description:
            "Get donation payment link info by order code",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDonationPaymentLink(
        @Args("orderCode", { type: () => String }) orderCode: string,
    ): Promise<DonationPaymentLinkResponse> {
        return this.donorService.getMyDonationPaymentLink(orderCode)
    }

    @Query(() => [Donation], {
        description: "Get donations for a specific campaign",
    })
    async getCampaignDonations(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
        @Args("sortBy", { type: () => DonationSortField, nullable: true })
            sortBy?: DonationSortField,
        @Args("sortOrder", { type: () => SortOrder, nullable: true })
            sortOrder?: SortOrder,
        @Args("searchDonorName", { type: () => String, nullable: true })
            searchDonorName?: string,
    ): Promise<Donation[]> {
        console.log("=== getCampaignDonations DEBUG ===")
        console.log("campaignId:", campaignId)
        console.log("skip:", skip)
        console.log("take:", take)
        console.log("sortBy:", sortBy)
        console.log("sortOrder:", sortOrder)
        console.log("searchDonorName:", searchDonorName)
        console.log("===================================")

        return this.donorService.getDonationsByCampaign(campaignId, {
            skip,
            take,
            filter: {
                sortBy,
                sortOrder,
                searchDonorName,
            },
        })
    }
}
