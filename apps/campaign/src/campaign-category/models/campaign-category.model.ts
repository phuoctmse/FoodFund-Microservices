import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { Campaign } from "../../campaign/models/campaign.model"
import { BaseSchema } from "../../shared/base/base.schema"

@ObjectType()
@Directive("@key(fields: \"id\")")
export class CampaignCategory extends BaseSchema {
    @Field(() => String, { description: "Category title" })
        title: string

    @Field(() => String, { description: "Category description" })
        description: string

    @Field(() => Boolean, { description: "Whether category is active" })
        isActive: boolean

    @Field(() => [Campaign], {
        description: "Campaigns in this category",
        defaultValue: [],
    })
        campaigns?: Campaign[]

    constructor() {
        super()
    }
}
