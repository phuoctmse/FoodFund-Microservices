import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { BaseSchema, CampaignPhase, User } from "../../shared"
import { MealBatchStatus } from "../enums"
import { MealBatchIngredientUsage } from "./meal-batch-ingredient-usage.model"

@ObjectType("MealBatch")
@Directive("@key(fields: \"id\")")
export class MealBatch extends BaseSchema {
    @Field(() => String, {
        description: "Campaign phase ID this meal batch belongs to",
    })
        campaignPhaseId: string

    @Field(() => String, {
        description: "Kitchen staff user ID who created the batch",
    })
        kitchenStaffId: string

    @Field(() => String, {
        nullable: true,
        description: "ID of the planned meal if selected from the list",
    })
        plannedMealId?: string

    @Field(() => String, {
        description: "Name of the food prepared (e.g., 'Cơm gà', 'Phở bò')",
    })
        foodName: string

    @Field(() => Int, {
        description: "Number of portions prepared",
    })
        quantity: number

    @Field(() => [String], {
        nullable: true,
        description: "Media URLs (images/videos of prepared food)",
    })
        media?: string[]

    @Field(() => MealBatchStatus, {
        description: "Current status of the meal batch",
    })
        status: MealBatchStatus

    @Field(() => Date, {
        nullable: true,
        description: "Date when the meal was cooked (set when status = READY)",
    })
        cookedDate?: Date

    @Field(() => User, {
        nullable: true,
        description: "Kitchen staff who created this batch",
    })
        kitchenStaff?: User

    @Field(() => CampaignPhase, {
        nullable: true,
        description: "Campaign phase this meal batch belongs to",
    })
        campaignPhase?: CampaignPhase

    @Field(() => [MealBatchIngredientUsage], {
        description: "List of ingredients used in this meal batch",
    })
        ingredientUsages: MealBatchIngredientUsage[]
}
