import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability"
import { UseGuards, UseInterceptors } from "@nestjs/common"
import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { CognitoGraphQLGuard, CurrentUser } from "@app/campaign/src/shared"
import { CampaignCategoryService } from "@app/campaign/src/application/services/campaign-category/campaign-category.service"
import { CreateCampaignCategoryInput, UpdateCampaignCategoryInput } from "@app/campaign/src/application/dtos/campaign-category/request"

@Resolver(() => CampaignCategory)
@UseInterceptors(SentryInterceptor)
@UseGuards(CognitoGraphQLGuard)
export class CampaignCategoryMutationResolver {
    constructor(
        private readonly campaignCategoryService: CampaignCategoryService,
    ) {}

    @Mutation(() => CampaignCategory, {
        description: "Create new campaign category (Admin only)",
    })
    async createCampaignCategory(
        @Args("input", {
            description: "Category creation input with title and description",
        })
            input: CreateCampaignCategoryInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignCategory> {
        return this.campaignCategoryService.createCategory(input, decodedToken)
    }

    @Mutation(() => CampaignCategory, {
        description: "Update campaign category (Admin only)",
    })
    async updateCampaignCategory(
        @Args("id", {
            type: () => String,
            description: "Category ID to update",
        })
            id: string,
        @Args("input", {
            description: "Update input with optional title and/or description",
        })
            input: UpdateCampaignCategoryInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignCategory> {
        return this.campaignCategoryService.updateCategory(
            id,
            input,
            decodedToken,
        )
    }

    @Mutation(() => Boolean, {
        description: "Delete campaign category (Admin only)",
    })
    async deleteCampaignCategory(
        @Args("id", {
            type: () => String,
            description: "Category ID to delete",
        })
            id: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<boolean> {
        return this.campaignCategoryService.deleteCategory(id, decodedToken)
    }
}
