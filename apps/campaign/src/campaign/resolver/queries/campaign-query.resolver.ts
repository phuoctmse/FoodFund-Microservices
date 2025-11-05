import { Args, Int, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { Campaign } from "../../models/campaign.model"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { UseGuards, UseInterceptors } from "@nestjs/common"
import { CampaignService } from "../../services/campaign.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
} from "../../dtos/request/campaign.input"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { createUserContextFromToken } from "../../../shared/types/user-context.type"
import { CurrentUser } from "../../../shared"

@Resolver(() => Campaign)
@UseInterceptors(SentryInterceptor)
export class CampaignQueryResolver {
    constructor(private readonly campaignService: CampaignService) {}

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
        return this.campaignService.getCampaigns(
            filter,
            search,
            sortBy,
            safeLimit,
            safeOffset,
        )
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
