import { OperationExpenseType } from "@app/operation/src/domain"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
export class CreateOperationRequestInput {
    @Field(() => String, {
        description: "Campaign phase ID for this operation request",
    })
    @IsNotEmpty({ message: "Campaign phase ID is required" })
    @IsString()
        campaignPhaseId: string

    @Field(() => String, {
        description: "Request title (5-100 characters)",
    })
    @IsNotEmpty({ message: "Title is required" })
    @IsString()
    @MinLength(5, { message: "Title must be at least 5 characters" })
    @MaxLength(100, { message: "Title must not exceed 100 characters" })
        title: string

    @Field(() => String, {
        description: "Total cost in VND (as string to handle BigInt)",
    })
    @IsNotEmpty({ message: "Total cost is required" })
    @IsString()
        totalCost: string

    @Field(() => OperationExpenseType, {
        description: "Expense type: COOKING or DELIVERY",
    })
    @IsNotEmpty({ message: "Expense type is required" })
    @IsEnum(OperationExpenseType, {
        message: "Expense type must be COOKING or DELIVERY",
    })
        expenseType: OperationExpenseType
}