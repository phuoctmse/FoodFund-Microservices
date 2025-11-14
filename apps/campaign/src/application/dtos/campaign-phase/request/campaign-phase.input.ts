import { InputType, Field } from "@nestjs/graphql"
import {
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    MinLength,
} from "class-validator"
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

    @Field(() => String, {
        description:
            "Ingredient budget percentage (0-100, e.g., '20.00'). " +
            "Note: Total of all phases (ingredient + cooking + delivery) must = 100%",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Ingredient budget percentage is required" })
        ingredientBudgetPercentage: string

    @Field(() => String, {
        description:
            "Cooking budget percentage (0-100, e.g., '10.00'). " +
            "Note: Total of all phases (ingredient + cooking + delivery) must = 100%",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Cooking budget percentage is required" })
        cookingBudgetPercentage: string

    @Field(() => String, {
        description:
            "Delivery budget percentage (0-100, e.g., '5.00'). " +
            "Note: Total of all phases (ingredient + cooking + delivery) must = 100%",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Delivery budget percentage is required" })
        deliveryBudgetPercentage: string
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

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsNumberString()
        ingredientBudgetPercentage?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsNumberString()
        cookingBudgetPercentage?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsNumberString()
        deliveryBudgetPercentage?: string
}
