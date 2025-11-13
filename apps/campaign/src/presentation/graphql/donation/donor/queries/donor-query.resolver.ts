import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { Donation } from "@app/campaign/src/domain/entities/donation.model"
import { DonorService } from "@app/campaign/src/application/services/donation/donor.service"
import { CampaignDonationStatementResponse, CampaignDonationSummary, DonationSortField, MyDonationDetailsResponse, MyDonationsResponse, SortOrder } from "@app/campaign/src/application/dtos/donation"

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

    @Query(() => MyDonationDetailsResponse, {
        description: "Get detailed payment information for a donation by order code",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDonationDetails(
        @CurrentUser("sub") userId: string,
        @Args("orderCode", { type: () => String }) orderCode: string,
    ): Promise<MyDonationDetailsResponse> {
        return this.donorService.getMyDonationDetails(orderCode, userId)
    }


    @Query(() => [CampaignDonationSummary], {
        description: "Get donation summaries for a specific campaign (public view)",
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
    ): Promise<CampaignDonationSummary[]> {

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

    @Query(() => CampaignDonationStatementResponse, {
        description:
            "Get detailed donation statement for a campaign (for CSV export and public transparency)",
    })
    async getCampaignDonationStatement(
        @Args("campaignId", { type: () => String }) campaignId: string,
    ): Promise<CampaignDonationStatementResponse> {
        return this.donorService.getCampaignDonationStatement(campaignId)
    }
}
