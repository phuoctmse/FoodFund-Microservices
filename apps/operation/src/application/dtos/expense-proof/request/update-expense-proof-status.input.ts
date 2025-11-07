import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsOptional, IsString, ValidateIf } from "class-validator"
import { ExpenseProofStatus } from "../../../../domain/enums/expense-proof-status.enum"

@InputType()
export class UpdateExpenseProofStatusInput {
    @Field(() => ExpenseProofStatus, {
        description: "New status for the expense proof",
    })
    @IsEnum(ExpenseProofStatus, {
        message: "Status must be APPROVED or REJECTED",
    })
        status: ExpenseProofStatus

    @Field(() => String, {
        nullable: true,
        description:
            "Admin note (required when REJECTED, optional when APPROVED)",
    })
    @ValidateIf((o) => o.status === ExpenseProofStatus.REJECTED)
    @IsString({ message: "Admin note must be a string" })
    @IsOptional()
        adminNote?: string
}
