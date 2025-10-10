import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType("CampaignCategoryStats")
export class CampaignCategoryStats extends CampaignCategory {
    @Field(() => Int, {
        description: "Number of active campaigns in this category",
    })
        campaignCount: number
}
