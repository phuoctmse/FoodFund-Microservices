import { Args, Query, Resolver } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability"
import { UseInterceptors } from "@nestjs/common"
import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { CampaignCategoryService } from "@app/campaign/src/application/services/campaign-category/campaign-category.service"
import { CampaignCategoryStats } from "@app/campaign/src/application/dtos/campaign-category/response"

@Resolver(() => CampaignCategory)
@UseInterceptors(SentryInterceptor)
export class CampaignCategoryQueryResolver {
    constructor(
        private readonly campaignCategoryService: CampaignCategoryService,
    ) {}

    @Query(() => [CampaignCategory], {
        description: "Get all campaign categories",
    })
    async campaignCategories(): Promise<CampaignCategory[]> {
        return this.campaignCategoryService.getCategories()
    }

    @Query(() => CampaignCategory, {
        description: "Get campaign category by ID",
        nullable: true,
    })
    async campaignCategory(
        @Args("id", {
            type: () => String,
            description: "Category ID",
        })
            id: string,
    ): Promise<CampaignCategory | null> {
        return await this.campaignCategoryService.findCategoryById(id)
    }

    @Query(() => [CampaignCategoryStats], {
        description: "Get categories with campaign counts",
    })
    async campaignCategoriesStats(): Promise<
        Array<CampaignCategory & { campaignCount: number }>
        > {
        return this.campaignCategoryService.getCategoriesWithStats()
    }
}
