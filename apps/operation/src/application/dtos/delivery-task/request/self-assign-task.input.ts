import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty, IsString } from "class-validator"

@InputType()
export class SelfAssignTaskInput {
    @Field(() => String, {
        description: "Meal batch ID to self-assign (must have status READY)",
    })
    @IsNotEmpty({ message: "Meal batch ID is required" })
    @IsString()
        mealBatchId: string
}