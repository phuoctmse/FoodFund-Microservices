import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType("CampaignCategoryStats")
export class CampaignCategoryStats extends CampaignCategory {
    @Field(() => Int, {
        description: "Number of active campaigns in this category",
    })
        campaignCount: number
}
