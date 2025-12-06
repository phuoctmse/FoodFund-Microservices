import { Field, InputType, Int } from "@nestjs/graphql"
import {
    IsInt,
    IsNotEmpty,
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
        description:
            "Quantity with unit (e.g., '5kg', '10 units', max 50 chars)",
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50, { message: "Quantity must not exceed 50 characters" })
        quantity: string

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
}
