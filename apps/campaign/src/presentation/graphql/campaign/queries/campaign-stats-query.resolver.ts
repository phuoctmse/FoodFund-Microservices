import { CognitoGraphQLGuard, createUserContextFromToken, CurrentUser } from "@app/campaign/src/shared"
import { UseGuards, UseInterceptors } from "@nestjs/common"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"
import { CampaignStatsResponse } from "@app/campaign/src/application/dtos/campaign/response/campaign-stats.response"
import { CampaignStatsFilterInput } from "@app/campaign/src/application/dtos/campaign/request/campaign-stats-filter.input"

@Resolver()
@UseInterceptors(SentryInterceptor)
export class CampaignStatsQueryResolver {
    constructor(private readonly campaignService: CampaignService) {}

    @Query(() => CampaignStatsResponse)
    async platformCampaignStats(
        @Args("filter", {
            type: () => CampaignStatsFilterInput,
            nullable: true,
        })
            filter?: CampaignStatsFilterInput,
    ): Promise<CampaignStatsResponse> {
        return await this.campaignService.getPlatformStats(filter)
    }

    @Query(() => CampaignStatsResponse)
    async categoryCampaignStats(
        @Args("categoryId", { type: () => String })
            categoryId: string,
    ): Promise<CampaignStatsResponse> {
        return await this.campaignService.getCategoryStats(categoryId)
    }

    @Query(() => CampaignStatsResponse)
    @UseGuards(CognitoGraphQLGuard)
    async myCampaignStats(
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignStatsResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.campaignService.getUserCampaignStats(userContext)
    }
}