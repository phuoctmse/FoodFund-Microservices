import { ObjectType, Field } from "@nestjs/graphql"
import { BaseSchema } from "../../shared"

@ObjectType({ description: "Planned ingredient for a campaign phase" })
export class PlannedIngredient extends BaseSchema {
    @Field(() => String, { description: "Campaign phase ID" })
        campaignPhaseId: string

    @Field(() => String, { description: "Ingredient name (e.g., 'Gạo', 'Thịt gà')" })
        name: string

    @Field(() => String, {
        description: "Planned quantity as decimal (e.g., '2.5', '10.75')",
    })
        quantity: string

    @Field(() => String, { description: "Unit of measurement (e.g., 'kg', 'ml', 'gói')" })
        unit: string
}