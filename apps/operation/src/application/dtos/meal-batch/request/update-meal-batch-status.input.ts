import { MealBatchStatus } from "@app/operation/src/domain/enums"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty } from "class-validator"

@InputType()
export class UpdateMealBatchStatusInput {
    @Field(() => MealBatchStatus, {
        description:
            "New status for the meal batch (Kitchen Staff: PREPARING → READY)",
    })
    @IsNotEmpty({ message: "Status is required" })
    @IsEnum(MealBatchStatus, { message: "Invalid meal batch status" })
        status: MealBatchStatus
}
