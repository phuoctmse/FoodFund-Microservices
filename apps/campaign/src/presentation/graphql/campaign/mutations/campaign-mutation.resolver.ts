import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"
import { SignedUrlResponse } from "@app/campaign/src/application/dtos/campaign/response"
import {
    ChangeStatusInput,
    CreateCampaignInput,
    ExtendCampaignInput,
    GenerateUploadUrlInput,
    UpdateCampaignInput,
} from "@app/campaign/src/application/dtos/campaign/request"
import {
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"

@Resolver(() => Campaign)
@UseInterceptors(SentryInterceptor)
export class CampaignMutationResolver {
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
        description: "Update campaign",
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
        @Args("input") input: ChangeStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.changeStatus(
            input.campaignId,
            input.newStatus,
            userContext,
            input.reason,
        )
    }

    @Mutation(() => Campaign, {
        description:
            "Mark campaign as completed (fundraiser only, all phases must be COMPLETED or FAILED)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async markCampaignComplete(
        @Args("campaignId", {
            type: () => String,
            description: "Campaign ID to mark as complete",
        })
            campaignId: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.markCampaignComplete(
            campaignId,
            userContext,
        )
    }

    @Mutation(() => Campaign, {
        description:
            "Extend campaign fundraising period (one-time only, max 30 days)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async extendCampaign(
        @Args("id", { type: () => String, description: "Campaign ID" })
            id: string,
        @Args(
            "input",
            { type: () => ExtendCampaignInput },
            new ValidationPipe(),
        )
            input: ExtendCampaignInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<Campaign> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignService.extendCampaign(id, input, userContext)
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
}
