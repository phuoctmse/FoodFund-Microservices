import { InputType, Field, Int } from "@nestjs/graphql"
import { IsString, IsInt, Min, MaxLength, IsNotEmpty, IsNumberString } from "class-validator"

@InputType({ description: "Input for creating a planned ingredient" })
export class PlannedIngredientInput {
    @Field(() => String, {
        description: "Ingredient name (e.g., 'Gạo', 'Thịt gà')",
    })
    @IsString()
    @IsNotEmpty({ message: "Ingredient name is required" })
    @MaxLength(100, {
        message: "Ingredient name must not exceed 100 characters",
    })
        name: string

    @Field(() => String, {
        description: "Planned quantity (decimal, e.g., '2.5', '10.75')",
    })
    @IsNumberString(
        { no_symbols: true },
        { message: "Quantity must be a valid decimal number" },
    )
    @IsNotEmpty({ message: "Quantity is required" })
        quantity: string

    @Field(() => String, {
        description: "Unit of measurement (e.g., 'kg', 'ml', 'gói')",
    })
    @IsString()
    @IsNotEmpty({ message: "Unit is required" })
    @MaxLength(50, { message: "Unit must not exceed 50 characters" })
        unit: string
}

@InputType({ description: "Input for updating a planned ingredient" })
export class UpdatePlannedIngredientInput {
    @Field(() => String, { nullable: true, description: "Ingredient name" })
    @IsString()
    @MaxLength(100, {
        message: "Ingredient name must not exceed 100 characters",
    })
        name?: string

    @Field(() => Int, { nullable: true, description: "Planned quantity" })
    @IsInt({ message: "Quantity must be an integer" })
    @Min(0, { message: "Quantity must be at least 0" })
        quantity?: number

    @Field(() => String, { nullable: true, description: "Unit of measurement" })
    @IsString()
    @MaxLength(50, { message: "Unit must not exceed 50 characters" })
        unit?: string
}
