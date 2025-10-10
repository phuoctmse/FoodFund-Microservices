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
import {
    Logger,
    UseGuards,
    UseInterceptors,
    ValidationPipe,
} from "@nestjs/common"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { CurrentUser } from "libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CampaignStatus } from "apps/campaign/src/campaign/enum/campaign.enum"
import { Donation } from "apps/campaign/src/donation/models/donation.model"
import { Campaign } from "./models/campaign.model"
import { CampaignService } from "./campaign.service"
import { SignedUrlResponse } from "./dtos/response/signed-url.response"
import { GenerateUploadUrlInput } from "./dtos/request/generate-upload-url.input"
import { createUserContextFromToken } from "../shared"
import {
    CampaignFilterInput,
    CampaignSortOrder,
    CreateCampaignInput,
    UpdateCampaignInput,
} from "./dtos/request/campaign.input"

@Resolver(() => Campaign)
@UseInterceptors(SentryInterceptor)
export class CampaignResolver {
    private readonly logger = new Logger(CampaignResolver.name)

    constructor(private readonly campaignService: CampaignService) {}

    @Mutation(() => SignedUrlResponse, {
        description:
            "Generate signed URL for campaign image upload (requires authentication)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async generateCampaignImageUploadUrl(
        @Args(
            "input",
            { type: () => GenerateUploadUrlInput },
            new ValidationPipe(),
        )
            input: GenerateUploadUrlInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<SignedUrlResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.generateCampaignImageUploadUrl(
            input,
            userContext,
        )
    }

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
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.createCampaign(input, userContext)
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
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.updateCampaign(id, input, userContext)
    }

    @Mutation(() => Campaign, {
        description: "Change campaign status (admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async changeCampaignStatus(
        @Args("id", { type: () => String }) id: string,
        @Args("status", { type: () => CampaignStatus }) status: CampaignStatus,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.changeStatus(id, status, userContext)
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

    @Mutation(() => Boolean, {
        description: "Delete campaign (only PENDING status, creator only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async deleteCampaign(
        @Args("id", {
            type: () => String,
            description: "Campaign ID to delete",
        })
            id: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<boolean> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.deleteCampaign(id, userContext)
    }

    @Query(() => String, {
        description: "Health check for campaign service",
    })
    campaignHealth(): string {
        const health = this.campaignService.getHealth()
        return `${health.service} is ${health.status} at ${health.timestamp}`
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
        const campaign = await this.campaignService.resolveReference(reference)
        return campaign
    }
}
