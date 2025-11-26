import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CampaignSearchService } from "@app/campaign/src/application/services/campaign/campaign-search.service"
import { SearchCampaignInput } from "@app/campaign/src/application/dtos/campaign/request/search-campaign.input"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { ObjectType, Field, Int } from "@nestjs/graphql"
import { SyncCampaignsResponse } from "../../../../application/dtos/campaign/response/sync-campaigns.response"

@ObjectType()
export class SearchCampaignResponse {
    @Field(() => [Campaign])
        items: Campaign[]

    @Field(() => Int)
        total: number

    @Field(() => Int)
        page: number

    @Field(() => Int)
        limit: number

    @Field(() => Int)
        totalPages: number
}

@Resolver(() => Campaign)
export class CampaignSearchResolver {
    constructor(private readonly campaignSearchService: CampaignSearchService) { }

    @Query(() => SearchCampaignResponse, { name: "searchCampaigns" })
    async searchCampaigns(
        @Args("input") input: SearchCampaignInput,
    ): Promise<SearchCampaignResponse> {
        return this.campaignSearchService.search(input)
    }

    @Mutation(() => SyncCampaignsResponse, { name: "syncCampaigns" })
    async syncCampaigns(): Promise<SyncCampaignsResponse> {
        return this.campaignSearchService.syncAll()
    }
}
