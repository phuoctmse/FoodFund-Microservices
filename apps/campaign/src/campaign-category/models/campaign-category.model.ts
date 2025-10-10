import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { AbstractSchema } from "../../../../../libs/databases/prisma/schemas/abstract.schema"
import { Campaign } from "../../campaign/models/campaign.model"

@ObjectType("CampaignCategory")
@Directive("@key(fields: \"id\")")
export class CampaignCategory extends AbstractSchema {
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
