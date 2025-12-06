import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty, IsString, IsArray, ArrayMinSize } from "class-validator"

@InputType()
export class AssignTaskToStaffInput {
    @Field(() => String, {
        description: "Meal batch ID (must have status READY)",
    })
    @IsNotEmpty({ message: "Meal batch ID is required" })
    @IsString()
        mealBatchId: string

    @Field(() => [String], {
        description: "Array of delivery staff IDs to assign the task to (at least 1 required)",
    })
    @IsArray({ message: "Delivery staff IDs must be an array" })
    @ArrayMinSize(1, { message: "At least 1 delivery staff is required" })
    @IsString({ each: true, message: "Each delivery staff ID must be a string" })
        deliveryStaffIds: string[]
}