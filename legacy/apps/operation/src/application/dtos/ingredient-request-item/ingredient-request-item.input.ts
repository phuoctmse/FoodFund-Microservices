import { Field, InputType, Int } from "@nestjs/graphql"
import {
    IsInt,
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from "class-validator"

@InputType()
export class CreateIngredientRequestItemInput {
    @Field(() => String, {
        description: "Ingredient name (max 100 characters)",
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100, {
        message: "Ingredient name must not exceed 100 characters",
    })
        ingredientName: string

    @Field(() => String, {
        description: "Quantity as decimal (e.g., '2.5', '10.75')",
    })
    @IsNumberString(
        {},
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

    @Field(() => Int, {
        description: "Estimated unit price in VND (must be > 0)",
    })
    @IsInt()
    @Min(1, { message: "Estimated unit price must be greater than 0" })
        estimatedUnitPrice: number

    @Field(() => Int, {
        description: "Estimated total price in VND (must be > 0)",
    })
    @IsInt()
    @Min(1, { message: "Estimated total price must be greater than 0" })
        estimatedTotalPrice: number

    @Field(() => String, {
        nullable: true,
        description: "Supplier name (e.g., 'Bách Hóa Xanh', max 200 chars)",
    })
    @IsOptional()
    @IsString()
    @MaxLength(200, { message: "Supplier name must not exceed 200 characters" })
        supplier?: string

    @Field(() => String, {
        nullable: true,
        description: "ID of the planned ingredient if selecting from the list",
    })
    @IsOptional()
        plannedIngredientId?: string
}
