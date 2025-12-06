import { DeliveryTaskStatus } from "@app/operation/src/domain"
import { Field, InputType, Int } from "@nestjs/graphql"
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator"

@InputType()
export class DeliveryTaskFilterInput {
    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID (fetches all tasks from all phases)",
    })
    @IsOptional()
    @IsString()
        campaignId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign phase ID",
    })
    @IsOptional()
    @IsString()
        campaignPhaseId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by meal batch ID",
    })
    @IsOptional()
    @IsString()
        mealBatchId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by delivery staff ID",
    })
    @IsOptional()
    @IsString()
        deliveryStaffId?: string

    @Field(() => DeliveryTaskStatus, {
        nullable: true,
        description: "Filter by status",
    })
    @IsOptional()
    @IsEnum(DeliveryTaskStatus)
        status?: DeliveryTaskStatus

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