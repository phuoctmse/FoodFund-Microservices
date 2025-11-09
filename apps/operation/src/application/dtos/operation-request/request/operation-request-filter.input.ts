import { OperationExpenseType, OperationRequestStatus } from "@app/operation/src/domain"
import { Field, InputType, Int } from "@nestjs/graphql"
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator"

@InputType()
export class OperationRequestFilterInput {
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

    @Field(() => OperationRequestStatus, {
        nullable: true,
        description: "Filter by status",
    })
    @IsOptional()
    @IsEnum(OperationRequestStatus)
        status?: OperationRequestStatus

    @Field(() => OperationExpenseType, {
        nullable: true,
        description: "Filter by expense type",
    })
    @IsOptional()
    @IsEnum(OperationExpenseType)
        expenseType?: OperationExpenseType

    @Field(() => Int, {
        nullable: true,
        defaultValue: 10,
        description: "Number of items per page (1-100)",
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
        limit?: number = 10

    @Field(() => Int, {
        nullable: true,
        defaultValue: 0,
        description: "Number of items to skip",
    })
    @IsOptional()
    @IsInt()
    @Min(0)
        offset?: number = 0
}