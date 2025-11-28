import { IngredientRequestStatus } from "@app/operation/src/domain/enums"
import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMinSize,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from "class-validator"
import { IngredientRequestSortOrder } from "@app/operation/src/domain/enums/ingredient-request"
import { CreateIngredientRequestItemInput } from "../../ingredient-request-item"

@InputType()
export class CreateIngredientRequestInput {
    @Field(() => String, {
        description: "Campaign phase ID for this request",
    })
    @IsNotEmpty()
        campaignPhaseId: string

    @Field(() => String, {
        description: "Total cost of all items (in VND, as string)",
    })
    @IsString()
    @IsNotEmpty()
        totalCost: string

    @Field(() => [CreateIngredientRequestItemInput], {
        description: "List of ingredient items (at least 1 required)",
    })
    @ValidateNested({ each: true })
    @Type(() => CreateIngredientRequestItemInput)
    @ArrayMinSize(1, { message: "At least one ingredient item is required" })
        items: CreateIngredientRequestItemInput[]
}

@InputType()
export class UpdateIngredientRequestStatusInput {
    @Field(() => IngredientRequestStatus, {
        description: "New status for the request",
    })
    @IsEnum(IngredientRequestStatus, {
        message: "Status must be a valid IngredientRequestStatus",
    })
        status: IngredientRequestStatus

    @Field(() => String, {
        nullable: true,
        description: "Admin note for rejection or approval",
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: "Admin note must not exceed 500 characters" })
        adminNote?: string
}

@InputType()
export class IngredientRequestFilterInput {
    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign phase ID",
    })
    @IsOptional()
    @IsString()
        campaignPhaseId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by campaign ID (fetches all phases for campaign)",
    })
    @IsOptional()
    @IsString()
        campaignId?: string

    @Field(() => IngredientRequestStatus, {
        nullable: true,
        description: "Filter by request status",
    })
    @IsOptional()
    @IsEnum(IngredientRequestStatus)
        status?: IngredientRequestStatus

    @Field(() => IngredientRequestSortOrder, {
        nullable: true,
        defaultValue: IngredientRequestSortOrder.NEWEST_FIRST,
        description: "Sort order for results",
    })
    @IsOptional()
    @IsEnum(IngredientRequestSortOrder)
        sortBy?: IngredientRequestSortOrder
}