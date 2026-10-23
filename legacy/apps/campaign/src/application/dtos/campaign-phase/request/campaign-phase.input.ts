import { InputType, Field } from "@nestjs/graphql"
import {
    IsArray,
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
    ValidateNested,
} from "class-validator"
import { Type } from "class-transformer"
import { PlannedMealInput } from "../../planned-meal"
import { PlannedIngredientInput } from "../../planned-ingredient"

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

    @Field(() => [PlannedMealInput], {
        nullable: true,
        description: "List of planned meals for this phase",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlannedMealInput)
        plannedMeals?: PlannedMealInput[]

    @Field(() => [PlannedIngredientInput], {
        nullable: true,
        description: "List of planned ingredients for this phase",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlannedIngredientInput)
        plannedIngredients?: PlannedIngredientInput[]
}

@InputType()
export class SyncPhaseInput {
    @Field(() => String, {
        nullable: true,
        description:
            "Phase ID - if provided, updates existing phase. If null/omitted, creates new phase",
    })
    @IsOptional()
    @IsUUID()
        id?: string

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
        description: "Ingredient budget percentage (0-100, e.g., '20.00')",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Ingredient budget percentage is required" })
        ingredientBudgetPercentage: string

    @Field(() => String, {
        description: "Cooking budget percentage (0-100, e.g., '10.00')",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Cooking budget percentage is required" })
        cookingBudgetPercentage: string

    @Field(() => String, {
        description: "Delivery budget percentage (0-100, e.g., '5.00')",
    })
    @IsNumberString()
    @IsNotEmpty({ message: "Delivery budget percentage is required" })
        deliveryBudgetPercentage: string

    @Field(() => [PlannedMealInput], {
        nullable: true,
        description: "List of planned meals for this phase",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlannedMealInput)
        plannedMeals?: PlannedMealInput[]

    @Field(() => [PlannedIngredientInput], {
        nullable: true,
        description: "List of planned ingredients for this phase",
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlannedIngredientInput)
        plannedIngredients?: PlannedIngredientInput[]
}
