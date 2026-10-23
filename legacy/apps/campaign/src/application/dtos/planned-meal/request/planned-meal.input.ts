import { InputType, Field, Int } from "@nestjs/graphql"
import { IsString, IsInt, Min, MaxLength, IsNotEmpty } from "class-validator"

@InputType({ description: "Input for creating a planned meal" })
export class PlannedMealInput {
    @Field(() => String, {
        description: "Meal name/description (e.g., 'Cơm gà', 'Phở bò')",
    })
    @IsString()
    @IsNotEmpty({ message: "Meal name is required" })
    @MaxLength(200, { message: "Meal name must not exceed 200 characters" })
        name: string

    @Field(() => Int, { description: "Planned quantity of this meal type" })
    @IsInt({ message: "Quantity must be an integer" })
    @Min(1, { message: "Quantity must be at least 1" })
        quantity: number
}

@InputType({ description: "Input for updating a planned meal" })
export class UpdatePlannedMealInput {
    @Field(() => String, {
        nullable: true,
        description: "Meal name/description",
    })
    @IsString()
    @MaxLength(200, { message: "Meal name must not exceed 200 characters" })
        name?: string

    @Field(() => Int, { nullable: true, description: "Planned quantity" })
    @IsInt({ message: "Quantity must be an integer" })
    @Min(0, { message: "Quantity must be at least 0" })
        quantity?: number
}
