import { MealBatchStatus } from "@app/operation/src/domain/enums"
import { Field, InputType } from "@nestjs/graphql"
import { IsEnum, IsOptional, IsString } from "class-validator"

@InputType()
export class MealBatchFilterInput {
    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign phase ID",
    })
    @IsOptional()
    @IsString()
        campaignPhaseId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by kitchen staff ID",
    })
    @IsOptional()
    @IsString()
        kitchenStaffId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID (for fundraisers/donors/guests)",
    })
    @IsOptional()
    @IsString()
        campaignId?: string

    @Field(() => MealBatchStatus, {
        nullable: true,
        description: "Filter by meal batch status",
    })
    @IsOptional()
    @IsEnum(MealBatchStatus, { message: "Invalid meal batch status" })
        status?: MealBatchStatus
}
