import { Field, Int, ObjectType } from "@nestjs/graphql"
import { CampaignCategory } from "../../models"

@ObjectType("CampaignCategoryStats")
export class CampaignCategoryStats extends CampaignCategory {
    @Field(() => Int, {
        description: "Number of active campaigns in this category",
    })
        campaignCount: number
}
