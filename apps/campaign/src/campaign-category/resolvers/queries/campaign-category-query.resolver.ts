import { Args, Query, Resolver } from "@nestjs/graphql"
import { SentryInterceptor } from "@libs/observability"
import { UseInterceptors } from "@nestjs/common"
import { CampaignCategory } from "../../models"
import { CampaignCategoryService } from "../../services"
import { CampaignCategoryStats } from "../../dtos"

@Resolver(() => CampaignCategory)
@UseInterceptors(SentryInterceptor)
export class CampaignCategoryQueryResolver {
    constructor(
        private readonly campaignCategoryService: CampaignCategoryService,
    ) {}

    @Query(() => [CampaignCategory], {
        description: "Get all active campaign categories",
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
