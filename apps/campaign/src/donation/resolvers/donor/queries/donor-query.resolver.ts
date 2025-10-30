import { Args, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "@app/campaign/src/shared"
import { Donation } from "../../../models/donation.model"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import {
    DonationSortField,
    SortOrder,
} from "../../../dtos/campaign-donations-filter.input"
import { DonorService } from "../../../services"
import { PaymentLinkInfo } from "../../../dtos/payment-link-info.dto"
import { MyDonationsResponse } from "../../../dtos/my-donations-response.dto"
import { CurrentUserType } from "@libs/auth"

@Resolver(() => Donation)
export class DonorQueryResolver {
    constructor(private readonly donorService: DonorService) {}

    @Query(() => PaymentLinkInfo, {
        description: "Get payment link information for my donation",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyDonationPaymentLink(
        @CurrentUser("sub") userId: string,
        @Args("orderCode", { type: () => String }) orderCode: string,
    ): Promise<PaymentLinkInfo> {
        return this.donorService.getPaymentLinkInfoByOrderCode(
            orderCode,
            userId,
        )
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
        return this.donorService.getMyDonationsWithTotal(userId, {
            skip,
            take,
        })
    }

    @Query(() => [Donation], {
        description: "Get donations for a specific campaign",
    })
    async getCampaignDonations(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
        @Args("searchDonorName", { type: () => String, nullable: true })
            searchDonorName?: string,
        @Args("sortBy", { type: () => DonationSortField, nullable: true })
            sortBy?: DonationSortField,
        @Args("sortOrder", { type: () => SortOrder, nullable: true })
            sortOrder?: SortOrder,
    ): Promise<Donation[]> {
        return this.donorService.getDonationsByCampaign(campaignId, {
            skip,
            take,
            filter: {
                searchDonorName,
                sortBy,
                sortOrder,
            },
        })
    }
}
