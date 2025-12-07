import { ObjectType, Field, ID, Directive, Int } from "@nestjs/graphql"

@ObjectType("IngredientRequestItem")
@Directive("@key(fields: \"id\")")
export class IngredientRequestItem {
    @Field(() => ID)
        id: string

    @Field(() => String, {
        description: "Parent ingredient request ID",
    })
        requestId: string

    @Field(() => String, {
        description: "Name of the ingredient (max 100 characters)",
    })
        ingredientName: string

    @Field(() => Int, { description: "Quantity of the ingredient" })
        quantity: number

    @Field(() => String, { description: "Unit of measurement (e.g., 'kg', 'ml', 'gói')" })
        unit: string

    @Field(() => Int, {
        description: "Estimated unit price in VND",
    })
        estimatedUnitPrice: number

    @Field(() => Int, {
        description: "Estimated total price in VND",
    })
        estimatedTotalPrice: number

    @Field(() => String, {
        nullable: true,
        description: "Supplier name (e.g., 'Bách Hóa Xanh - District 1')",
    })
        supplier?: string

    @Field(() => String, {
        nullable: true,
        description: "ID of the planned ingredient if selected from the list",
    })
        plannedIngredientId?: string

    constructor() {}
}
