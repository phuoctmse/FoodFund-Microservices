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

    @Field(() => String, {
        description: "Quantity with unit (e.g., '5kg', '10 units')",
    })
        quantity: string

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

    constructor() {}
}
