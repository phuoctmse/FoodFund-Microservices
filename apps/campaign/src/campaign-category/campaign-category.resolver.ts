import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { SentryInterceptor } from "@libs/observability/sentry.interceptor"
import { UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CampaignCategoryService } from "./campaign-category.service"
import { CurrentUser } from "libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import {
    CreateCampaignCategoryInput,
    UpdateCampaignCategoryInput,
} from "./dtos/request/campaign-category.input"
import { CampaignCategoryStats } from "./dtos/response/campaign-category-stats.response"

@Resolver(() => CampaignCategory)
@UseInterceptors(SentryInterceptor)
export class CampaignCategoryResolver {
    constructor(
        private readonly campaignCategoryService: CampaignCategoryService,
    ) {}

    // ===== QUERIES =====

    /**
     * Get all active campaign categories for selection
     * Public query - no authentication required
     */
    @Query(() => [CampaignCategory], {
        description: "Get all active campaign categories for selection",
    })
    async campaignCategories(): Promise<CampaignCategory[]> {
        return this.campaignCategoryService.getCategories()
    }

    /**
     * Get single category by ID
     * Public query - no authentication required
     */
    @Query(() => CampaignCategory, {
        description: "Get campaign category by ID",
        nullable: true,
    })
    async campaignCategory(
        @Args("id", { type: () => String }) id: string,
    ): Promise<CampaignCategory | null> {
        return await this.campaignCategoryService.findCategoryById(id)
    }

    /**
     * Get categories with campaign statistics
     * Admin query for dashboard analytics
     */
    @Query(() => [CampaignCategoryStats], {
        description: "Get categories with campaign counts (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async campaignCategoriesStats(
        @CurrentUser("sub") userId: string,
    ): Promise<Array<CampaignCategory & { campaignCount: number }>> {
        return this.campaignCategoryService.getCategoriesWithStats()
    }

    // ===== MUTATIONS =====

    /**
     * Create new campaign category
     * Admin only mutation
     */
    @Mutation(() => CampaignCategory, {
        description: "Create new campaign category (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async createCampaignCategory(
        @Args("input") input: CreateCampaignCategoryInput,
        @CurrentUser("sub") userId: string,
    ): Promise<CampaignCategory> {
        return this.campaignCategoryService.createCategory(input)
    }

    /**
     * Update campaign category
     * Admin only mutation
     */
    @Mutation(() => CampaignCategory, {
        description: "Update campaign category (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async updateCampaignCategory(
        @Args("id") id: string,
        @Args("input") input: UpdateCampaignCategoryInput,
    ): Promise<CampaignCategory> {
        return this.campaignCategoryService.updateCategory(id, input)
    }

    /**
     * Delete campaign category (soft delete)
     * Admin only mutation
     */
    @Mutation(() => Boolean, {
        description: "Delete campaign category (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async deleteCampaignCategory(@Args("id") id: string): Promise<boolean> {
        return this.campaignCategoryService.deleteCategory(id)
    }

    /**
     * Reactivate campaign category
     * Admin only mutation
     */
    @Mutation(() => CampaignCategory, {
        description: "Reactivate campaign category (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async reactivateCampaignCategory(
        @Args("id") id: string,
    ): Promise<CampaignCategory> {
        return this.campaignCategoryService.reactivateCategory(id)
    }
}
