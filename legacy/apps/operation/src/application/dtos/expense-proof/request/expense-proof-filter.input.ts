import { ExpenseProofStatus } from "@app/operation/src/domain/enums"
import { ExpenseProofSortOrder } from "@app/operation/src/domain/enums/expense-proof"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsOptional, IsString } from "class-validator"

@InputType()
export class ExpenseProofFilterInput {
    @Field(() => ExpenseProofStatus, {
        nullable: true,
        description: "Filter by proof status",
    })
    @IsOptional()
    @IsEnum(ExpenseProofStatus)
        status?: ExpenseProofStatus

    @Field(() => String, {
        nullable: true,
        description: "Filter by ingredient request ID",
    })
    @IsOptional()
    @IsString()
        requestId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign phase ID",
    })
    @IsOptional()
    @IsString()
        campaignPhaseId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID",
    })
    @IsOptional()
    @IsString()
        campaignId?: string

    @Field(() => ExpenseProofSortOrder, {
        nullable: true,
        defaultValue: ExpenseProofSortOrder.NEWEST_FIRST,
        description: "Sort order for expense proofs",
    })
    @IsOptional()
    @IsEnum(ExpenseProofSortOrder)
        sortBy?: ExpenseProofSortOrder
}
