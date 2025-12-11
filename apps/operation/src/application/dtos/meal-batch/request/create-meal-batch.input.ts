import { Field, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"

@InputType()
export class CreateMealBatchInput {
    @Field(() => String, {
        description: "Campaign phase ID this meal batch belongs to",
    })
    @IsNotEmpty({ message: "Campaign phase ID is required" })
    @IsString()
        campaignPhaseId: string

    @Field(() => String, {
        nullable: true,
        description:
            "ID of the planned meal if selecting from the list (optional for custom meals)",
    })
    @IsOptional()
        plannedMealId?: string

    @Field(() => String, {
        description: "Name of the food prepared (e.g., 'Cơm gà', 'Phở bò')",
    })
    @IsString()
    @IsNotEmpty({ message: "Food name is required" })
    @MinLength(3, { message: "Food name must be at least 3 characters" })
    @MaxLength(100, { message: "Food name must not exceed 100 characters" })
        foodName: string

    @Field(() => Int, {
        description: "Number of portions prepared (must be > 0)",
    })
    @IsInt({ message: "Quantity must be an integer" })
    @Min(1, { message: "Quantity must be at least 1" })
        quantity: number

    @Field(() => [String], {
        description:
            "Array of media file keys from DigitalOcean Spaces (required)",
    })
    @IsArray({ message: "Media file keys must be an array" })
    @ArrayMinSize(1, { message: "At least 1 media file is required" })
    @IsString({ each: true, message: "Each media file key must be a string" })
        mediaFileKeys: string[]

    @Field(() => [String], {
        description: "Array of ingredient request item IDs used in this batch",
    })
    @IsArray({ message: "Ingredient IDs must be an array" })
    @ArrayMinSize(1, { message: "At least 1 ingredient is required" })
    @IsString({ each: true, message: "Each ingredient ID must be a string" })
        ingredientIds: string[]
}
