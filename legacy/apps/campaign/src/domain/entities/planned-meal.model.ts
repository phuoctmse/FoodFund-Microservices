import { ObjectType, Field, Int } from "@nestjs/graphql"
import { BaseSchema } from "../../shared"

@ObjectType({ description: "Planned meal for a campaign phase" })
export class PlannedMeal extends BaseSchema {
    @Field(() => String, { description: "Campaign phase ID" })
        campaignPhaseId: string

    @Field(() => String, {
        description: "Meal name/description (e.g., 'Cơm gà', 'Phở bò')",
    })
        name: string

    @Field(() => Int, { description: "Planned quantity of this meal type" })
        quantity: number
}
