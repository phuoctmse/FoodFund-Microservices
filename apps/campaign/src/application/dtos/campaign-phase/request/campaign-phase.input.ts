import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator"
import { Type } from "class-transformer"

@InputType()
export class CreatePhaseInput {
    @Field(() => String, {
        description: "Phase name (e.g., 'Phase 1 - District 1')",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: "Phase name must be at least 5 characters" })
        phaseName: string

    @Field(() => String, { description: "Delivery location for this phase" })
    @IsString()
    @IsNotEmpty()
        location: string

    @Field(() => Date, { description: "Ingredient purchase date (ISO 8601)" })
    @Type(() => Date)
    @IsNotEmpty()
        ingredientPurchaseDate: Date

    @Field(() => Date, { description: "Cooking date (ISO 8601)" })
    @Type(() => Date)
    @IsNotEmpty()
        cookingDate: Date

    @Field(() => Date, {
        description: "Delivery date (ISO 8601, must be ≤24h from cooking)",
    })
    @Type(() => Date)
    @IsNotEmpty()
        deliveryDate: Date
}

@InputType()
export class UpdatePhaseInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(5, { message: "Phase name must be at least 5 characters" })
        phaseName?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        location?: string

    @Field(() => Date, { nullable: true })
    @IsOptional()
    @Type(() => Date)
        ingredientPurchaseDate?: Date

    @Field(() => Date, { nullable: true })
    @IsOptional()
    @Type(() => Date)
        cookingDate?: Date

    @Field(() => Date, { nullable: true })
    @IsOptional()
    @Type(() => Date)
        deliveryDate?: Date
}
