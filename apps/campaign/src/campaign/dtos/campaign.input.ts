import { Field, InputType, registerEnumType } from "@nestjs/graphql"
import {
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from "class-validator"
import { CampaignStatus } from "../enums/campaign.enums"
import { Transform, Type } from "class-transformer"

@InputType()
export class CreateCampaignInput {
    @Field(() => String, { description: "Campaign title" })
    @IsString({ message: "Title must be a string" })
    @IsNotEmpty({ message: "Title is required and cannot be empty" })
        title: string

    @Field(() => String, { description: "Campaign description" })
    @IsString({ message: "Description must be a string" })
    @IsNotEmpty({ message: "Description is required and cannot be empty" })
        description: string

    @Field(() => String, { description: "Campaign cover image URL" })
    @IsString({ message: "Cover image URL must be a string" })
    @IsNotEmpty({ message: "Cover image URL is required" })
        coverImage: string

    @Field(() => String, { description: "Campaign location" })
    @IsString({ message: "Location must be a string" })
    @IsNotEmpty({ message: "Location is required and cannot be empty" })
        location: string

    @Field(() => String, {
        description: "Target amount as string (BigInt compatible)",
    })
    @IsString({ message: "Target amount must be a string" })
    @IsNotEmpty({ message: "Target amount is required" })
        targetAmount: string

    @Field(() => Date, { description: "Campaign start date (ISO 8601)" })
    @Type(() => Date)
    @IsDate({ message: "Start date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for startDate")
            }
            return date
        }
        return value
    })
        startDate: Date

    @Field(() => Date, { description: "Campaign end date (ISO 8601)" })
    @Type(() => Date)
    @IsDate({ message: "End date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for endDate")
            }
            return date
        }
        return value
    })
        endDate: Date
}

@InputType()
export class UpdateCampaignInput {
    @Field(() => String, { nullable: true, description: "Campaign title" })
    @IsOptional()
    @IsString({ message: "Title must be a string" })
    @IsNotEmpty({ message: "Title cannot be empty if provided" })
        title?: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign description",
    })
    @IsOptional()
    @IsString({ message: "Description must be a string" })
    @IsNotEmpty({ message: "Description cannot be empty if provided" })
        description?: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign cover image URL",
    })
    @IsOptional()
    @IsString({ message: "Cover image URL must be a string" })
        coverImage?: string

    @Field(() => String, { nullable: true, description: "Campaign location" })
    @IsOptional()
    @IsString({ message: "Location must be a string" })
        location?: string

    @Field(() => String, {
        nullable: true,
        description: "Target amount as string",
    })
    @IsOptional()
    @IsString({ message: "Target amount must be a string" })
        targetAmount?: string

    @Field(() => Date, { nullable: true, description: "Campaign start date" })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Start date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for startDate")
            }
            return date
        }
        return value
    })
        startDate?: Date

    @Field(() => Date, { nullable: true, description: "Campaign end date" })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "End date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for endDate")
            }
            return date
        }
        return value
    })
        endDate?: Date
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
}

export enum CampaignSortOrder {
    ACTIVE_FIRST = "ACTIVE_FIRST",
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    TARGET_AMOUNT_ASC = "TARGET_AMOUNT_ASC",
    TARGET_AMOUNT_DESC = "TARGET_AMOUNT_DESC",
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
    },
})
