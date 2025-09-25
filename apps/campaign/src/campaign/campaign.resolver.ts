import {
    Args,
    Int,
    Mutation,
    Parent,
    Query,
    ResolveField,
    Resolver,
    ResolveReference,
} from "@nestjs/graphql"
import { Campaign, Donation, User } from "./models/campaign.model"
import {
    Logger,
    UseGuards,
    UseInterceptors,
    ValidationPipe,
} from "@nestjs/common"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { CampaignService } from "./campaign.service"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    UpdateCampaignInput,
} from "./dtos/campaign.input"
import { CurrentUser } from "libs/auth"
import { CampaignStatus } from "./enums/campaign.enums"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => Campaign)
@UseInterceptors(SentryInterceptor)
export class CampaignResolver {
    private readonly logger = new Logger(CampaignResolver.name)

    constructor(private readonly campaignService: CampaignService) {}

    @Mutation(() => Campaign, {
        description: "Create a new campaign (requires authentication)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createCampaign(
        @Args(
            "input",
            { type: () => CreateCampaignInput },
            new ValidationPipe(),
        )
            input: CreateCampaignInput,
        @CurrentUser("sub") userId: string,
    ): Promise<Campaign> {
        return this.campaignService.createCampaign(input, userId)
    }

    @Mutation(() => Campaign, {
        description: "Update campaign (only creator, before approval)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateCampaign(
        @Args("id", { type: () => String }) id: string,
        @Args(
            "input",
            { type: () => UpdateCampaignInput },
            new ValidationPipe(),
        )
            input: UpdateCampaignInput,
        @CurrentUser("sub") userId: string,
    ): Promise<Campaign> {
        return this.campaignService.updateCampaign(id, input, userId)
    }

    @Mutation(() => Campaign, {
        description: "Change campaign status (admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async changeCampaignStatus(
        @Args("id", { type: () => String }) id: string,
        @Args("status", { type: () => CampaignStatus }) status: CampaignStatus,
        @CurrentUser("sub") userId: string,
    ): Promise<Campaign> {
        return this.campaignService.changeStatus(id, status, userId)
    }

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
        this.logger.log(`Fetching campaign: ${id}`)
        try {
            return await this.campaignService.findCampaignById(id)
        } catch (error) {
            if (error.message?.includes("not found")) {
                return null
            }
            throw error
        }
    }

    @Query(() => [Campaign], {
        description: "Get campaigns created by user (requires authentication)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async myCampaigns(
        @CurrentUser("sub") userId: string,
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
        const safeLimit = Math.min(Math.max(limit, 1), 100)
        const safeOffset = Math.max(offset, 0)
        return this.campaignService.getCampaigns(
            { creatorId: userId },
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

    @ResolveField(() => User, { nullable: true })
    creator(@Parent() campaign: Campaign): User {
        return { id: campaign.createdBy }
    }

    @ResolveField(() => [Donation])
    donations(@Parent() campaign: Campaign): Donation[] {
        return []
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<Campaign> {
        return this.campaignService.resolveReference(reference)
    }
}
