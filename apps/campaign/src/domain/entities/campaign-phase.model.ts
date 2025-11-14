import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema } from "../../shared"
import { CampaignPhaseStatus } from "../enums/campaign-phase/campaign-phase.enum"
import { Campaign } from "./campaign.model"

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

    @Field(() => String, {
        description: "Ingredient budget percentage (0-100)",
    })
        ingredientBudgetPercentage: string

    @Field(() => String, {
        description: "Cooking budget percentage (0-100)",
    })
        cookingBudgetPercentage: string

    @Field(() => String, {
        description: "Delivery budget percentage (0-100)",
    })
        deliveryBudgetPercentage: string

    @Field(() => String, {
        nullable: true,
    })
        ingredientFundsAmount?: string

    @Field(() => String, {
        nullable: true,
    })
        cookingFundsAmount?: string

    @Field(() => String, {
        nullable: true,
    })
        deliveryFundsAmount?: string

    @Field(() => CampaignPhaseStatus, { description: "Phase execution status" })
        status: CampaignPhaseStatus

    @Field(() => Campaign, { nullable: true })
        campaign?: Campaign

    constructor() {
        super()
    }
}
