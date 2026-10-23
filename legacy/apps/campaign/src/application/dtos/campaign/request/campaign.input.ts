import { InputType, Field, Int, registerEnumType } from "@nestjs/graphql"
import {
    IsNotEmpty,
    IsString,
    IsNumberString,
    IsOptional,
    IsUUID,
    MinLength,
    MaxLength,
    Min,
    Max,
    IsEnum,
} from "class-validator"
import { Type } from "class-transformer"
import { CreatePhaseInput } from "../../campaign-phase/request"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"

@InputType()
export class CreateCampaignInput {
    @Field(() => String, { description: "Campaign title" })
    @IsString()
    @IsNotEmpty()
    @MinLength(5, { message: "Title must be at least 5 characters" })
    @MaxLength(200, { message: "Title must not exceed 200 characters" })
        title: string

    @Field(() => String, { description: "Campaign description" })
    @IsString()
    @IsNotEmpty()
    @MinLength(20, { message: "Description must be at least 20 characters" })
        description: string

    @Field(() => String, {
        description: "Cover image file key from generateUploadUrl",
    })
    @IsString()
    @IsNotEmpty()
        coverImageFileKey: string

    @Field(() => String, {
        description: "Target amount as string (e.g., '10000000')",
    })
    @IsNumberString({}, { message: "Target amount must be a number string" })
    @IsNotEmpty()
        targetAmount: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign category UUID",
    })
    @IsOptional()
    @IsUUID()
        categoryId?: string

    @Field(() => Date, { description: "Fundraising start date (ISO 8601)" })
    @Type(() => Date)
    @IsNotEmpty()
        fundraisingStartDate: Date

    @Field(() => Date, { description: "Fundraising end date (ISO 8601)" })
    @Type(() => Date)
    @IsNotEmpty()
        fundraisingEndDate: Date

    @Field(() => [CreatePhaseInput], {
        description: "Campaign phases (at least 1 required)",
    })
    @Type(() => CreatePhaseInput)
    @IsNotEmpty({ message: "At least one phase is required" })
        phases: CreatePhaseInput[]
}

@InputType()
export class UpdateCampaignInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(5)
    @MaxLength(200)
        title?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(20)
        description?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        coverImageFileKey?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsNumberString()
        targetAmount?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
        categoryId?: string

    @Field(() => Date, { nullable: true })
    @IsOptional()
    @Type(() => Date)
        fundraisingStartDate?: Date

    @Field(() => Date, { nullable: true })
    @IsOptional()
    @Type(() => Date)
        fundraisingEndDate?: Date
}

@InputType()
export class ExtendCampaignInput {
    @Field(() => Int, {
        description: "Number of days to extend (1-30)",
    })
    @Min(1, { message: "Extension days must be at least 1" })
    @Max(30, { message: "Extension days cannot exceed 30" })
        extensionDays: number
}

@InputType()
export class CampaignFilterInput {
    @Field(() => [CampaignStatus], {
        nullable: true,
        description: "Filter by campaign status",
    })
    @IsOptional()
    @IsEnum(CampaignStatus, {
        each: true,
        message: "Each status must be a valid CampaignStatus",
    })
        status?: CampaignStatus[]

    @Field(() => String, {
        nullable: true,
        description: "Filter by creator ID",
    })
    @IsOptional()
    @IsUUID(4, { message: "Creator ID must be a valid UUID" })
        creatorId?: string

    @Field(() => String, {
        nullable: true,
        description: "Filter by category ID",
    })
    @IsOptional()
    @IsUUID(4, { message: "Category ID must be a valid UUID" })
        categoryId?: string
}

export enum CampaignSortOrder {
    ACTIVE_FIRST = "ACTIVE_FIRST",
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    TARGET_AMOUNT_ASC = "TARGET_AMOUNT_ASC",
    TARGET_AMOUNT_DESC = "TARGET_AMOUNT_DESC",
    MOST_DONATED = "MOST_DONATED",
    LEAST_DONATED = "LEAST_DONATED",
}

registerEnumType(CampaignSortOrder, {
    name: "CampaignSortOrder",
    description: "Campaign sorting options for efficient data retrieval",
    valuesMap: {
        ACTIVE_FIRST: {
            description:
                "Sort by campaign status (active campaigns first), then by creation date",
        },
        NEWEST_FIRST: {
            description: "Sort by creation date (newest first)",
        },
        OLDEST_FIRST: {
            description: "Sort by creation date (oldest first)",
        },
        TARGET_AMOUNT_ASC: {
            description: "Sort by target amount (lowest to highest)",
        },
        TARGET_AMOUNT_DESC: {
            description: "Sort by target amount (highest to lowest)",
        },
        MOST_DONATED: {
            description: "Sort by donation count (most donated first)",
        },
        LEAST_DONATED: {
            description: "Sort by donation count (least donated first)",
        },
    },
})
