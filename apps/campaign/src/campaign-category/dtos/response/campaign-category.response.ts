import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType("CampaignCategoriesResponse")
export class CampaignCategoriesResponse {
    @Field(() => [CampaignCategory], { description: "List of categories" })
        categories: CampaignCategory[]

    @Field(() => Int, {
        description: "Total number of categories matching the query",
    })
        total: number

    @Field(() => Boolean, {
        description: "Whether there are more categories available",
    })
        hasMore: boolean

    @Field(() => Int, { description: "Number of categories requested" })
        limit: number

    @Field(() => Int, { description: "Number of categories skipped" })
        offset: number
}

@ObjectType("CampaignCategoryOption")
export class CampaignCategoryOption {
    @Field(() => String, { description: "Category ID" })
        id: string

    @Field(() => String, { description: "Category title" })
        title: string

    @Field(() => String, { description: "Category description" })
        description: string

    @Field(() => Boolean, { description: "Whether category is active" })
        isActive: boolean
}
