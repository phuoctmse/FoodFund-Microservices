import { Args, Int, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { UseGuards, UseInterceptors } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"
import { CampaignFilterInput, CampaignSortOrder } from "@app/campaign/src/application/dtos/campaign/request"
import { createUserContextFromToken, CurrentUser } from "@app/campaign/src/shared"

import { CampaignSearchService } from "@app/campaign/src/application/services/campaign/campaign-search.service"
import { CampaignSortBy } from "@app/campaign/src/application/dtos/campaign/request/search-campaign.input"

@Resolver(() => Campaign)
@UseInterceptors(SentryInterceptor)
export class CampaignQueryResolver {
    constructor(
        private readonly campaignService: CampaignService,
        private readonly campaignSearchService: CampaignSearchService,
    ) { }

    @Query(() => [Campaign], {
        description: "Get campaigns with filtering, search, and pagination",
    })
    async campaigns(
        @Args("filter", { type: () => CampaignFilterInput, nullable: true })
            filter?: CampaignFilterInput,
        @Args("search", { type: () => String, nullable: true })
            search?: string,
        @Args("sortBy", {
            type: () => CampaignSortOrder,
            nullable: true,
            defaultValue: CampaignSortOrder.ACTIVE_FIRST,
        })
            sortBy: CampaignSortOrder = CampaignSortOrder.ACTIVE_FIRST,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of campaigns to return (max 100)",
        })
            limit: number = 10,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of campaigns to skip",
        })
            offset: number = 0,
    ): Promise<Campaign[]> {
        const safeLimit = Math.min(Math.max(limit, 1), 100)
        const safeOffset = Math.max(offset, 0)
        const page = Math.floor(safeOffset / safeLimit) + 1

        try {
            const result = await this.campaignSearchService.search({
                query: search,
                categoryId: filter?.categoryId,
                creatorId: filter?.creatorId,
                status: filter?.status,
                sortBy: sortBy as unknown as CampaignSortBy,
                page,
                limit: safeLimit,
            })
            return result.items
        } catch (error) {
            console.warn(
                `OpenSearch failed, falling back to database. Error: ${error.message}`,
            )
            return this.campaignService.getCampaigns(
                filter,
                search,
                sortBy,
                safeLimit,
                safeOffset,
            )
        }
    }

    @Query(() => Campaign, {
        description: "Get campaign by ID",
        nullable: true,
    })
    async campaign(
        @Args("id", { type: () => String }) id: string,
    ): Promise<Campaign | null> {
        return await this.campaignService.findCampaignById(id)
    }

    @Query(() => [Campaign], {
        description: "Get campaigns created by user (requires authentication)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async myCampaigns(
        @CurrentUser() decodedToken: any,
        @Args("sortBy", {
            type: () => CampaignSortOrder,
            nullable: true,
            defaultValue: CampaignSortOrder.NEWEST_FIRST,
        })
            sortBy: CampaignSortOrder = CampaignSortOrder.NEWEST_FIRST,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
        })
            limit: number = 10,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
        })
            offset: number = 0,
    ): Promise<Campaign[]> {
        const userContext = createUserContextFromToken(decodedToken)
        const safeLimit = Math.min(Math.max(limit, 1), 100)
        const safeOffset = Math.max(offset, 0)
        return this.campaignService.getCampaigns(
            { creatorId: userContext.userId },
            undefined,
            sortBy,
            safeLimit,
            safeOffset,
        )
    }

    @Query(() => String, {
        description: "Health check for campaign service",
    })
    campaignHealth(): string {
        const health = this.campaignService.getHealth()
        return `${health.service} is ${health.status} at ${health.timestamp}`
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<Campaign> {
        const campaign = await this.campaignService.resolveReference(reference)
        return campaign
    }
}
