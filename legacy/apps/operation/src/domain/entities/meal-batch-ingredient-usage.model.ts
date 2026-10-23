import { Field, ID, ObjectType } from "@nestjs/graphql"
import { IngredientRequestItem } from "./ingredient-request-item.model"

@ObjectType("MealBatchIngredientUsage")
export class MealBatchIngredientUsage {
    @Field(() => ID)
        id: string

    @Field(() => String, {
        description: "Meal batch ID this usage belongs to",
    })
        mealBatchId: string

    @Field(() => String, {
        description: "Ingredient request item ID used in this batch",
    })
        ingredientId: string

    @Field(() => IngredientRequestItem, {
        description: "Ingredient request item details",
    })
        ingredientItem: IngredientRequestItem
}
