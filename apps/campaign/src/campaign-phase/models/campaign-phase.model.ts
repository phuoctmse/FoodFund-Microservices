import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema } from "../../shared"
import { CampaignPhaseStatus } from "../enum"
import { Campaign } from "../../campaign/models"

@ObjectType("CampaignPhase")
@Directive("@key(fields: \"id\")")
export class CampaignPhase extends BaseSchema {
    @Field(() => String, { description: "Campaign ID this phase belongs to" })
        campaignId: string

    @Field(() => String, {
        description: "Phase name (e.g., 'Phase 1 - North District')",
    })
        phaseName: string

    @Field(() => String, { description: "Delivery location for this phase" })
        location: string

    @Field(() => Date, { description: "Ingredient purchase date" })
        ingredientPurchaseDate: Date

    @Field(() => Date, { description: "Cooking date" })
        cookingDate: Date

    @Field(() => Date, { description: "Delivery date" })
        deliveryDate: Date

    @Field(() => CampaignPhaseStatus, { description: "Phase execution status" })
        status: CampaignPhaseStatus

    @Field(() => Campaign, { nullable: true })
        campaign?: Campaign

    constructor() {
        super()
    }
}
