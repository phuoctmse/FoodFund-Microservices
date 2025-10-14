import { Field, InputType, registerEnumType } from "@nestjs/graphql"
import {
    IsDate,
    IsEnum,
    IsNotEmpty,
    IsNumberString,
    IsOptional,
    IsString,
    IsUUID,
} from "class-validator"
import { Transform, Type } from "class-transformer"
import { CampaignStatus } from "apps/campaign/src/campaign/enum/campaign.enum"

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

    @Field(() => String, {
        description:
            "File key of uploaded cover image (from generateUploadUrl)",
    })
    @IsString({ message: "Cover image file key must be a string" })
    @IsNotEmpty({ message: "Cover image file key is required" })
        coverImageFileKey: string

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

    @Field(() => String, {
        nullable: true,
        description: "Campaign category ID",
    })
    @IsOptional()
    @IsUUID(4, { message: "Category ID must be a valid UUID" })
        categoryId?: string

    @Field(() => String, {
        description: "Ingredient budget percentage (0-100, e.g., '60.00')",
        defaultValue: "60.00",
    })
    @IsNumberString(
        {},
        { message: "Ingredient budget percentage must be a number string" },
    )
        ingredientBudgetPercentage: string = "60.00"

    @Field(() => String, {
        description: "Cooking budget percentage (0-100, e.g., '25.00')",
        defaultValue: "25.00",
    })
    @IsNumberString(
        {},
        { message: "Cooking budget percentage must be a number string" },
    )
        cookingBudgetPercentage: string = "25.00"

    @Field(() => String, {
        description: "Delivery budget percentage (0-100, e.g., '15.00')",
        defaultValue: "15.00",
    })
    @IsNumberString(
        {},
        { message: "Delivery budget percentage must be a number string" },
    )
        deliveryBudgetPercentage: string = "15.00"

    @Field(() => Date, { description: "Fundraising start date (ISO 8601)" })
    @Type(() => Date)
    @IsDate({ message: "Fundraising start date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for fundraisingStartDate")
            }
            return date
        }
        return value
    })
        fundraisingStartDate: Date

    @Field(() => Date, { description: "Fundraising end date" })
    @Type(() => Date)
    @IsDate({ message: "Fundraising end date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for fundraisingEndDate")
            }
            return date
        }
        return value
    })
        fundraisingEndDate: Date

    @Field(() => Date, { description: "Ingredient purchase date" })
    @Type(() => Date)
    @IsDate({ message: "Ingredient purchase date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error(
                    "Invalid date format for ingredientPurchaseDate",
                )
            }
            return date
        }
        return value
    })
        ingredientPurchaseDate: Date

    @Field(() => Date, { description: "Cooking date" })
    @Type(() => Date)
    @IsDate({ message: "Cooking date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for cookingDate")
            }
            return date
        }
        return value
    })
        cookingDate: Date

    @Field(() => Date, { description: "Delivery date (ISO 8601)" })
    @Type(() => Date)
    @IsDate({ message: "Delivery date must be a valid date" })
    @Transform(({ value }) => {
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for deliveryDate")
            }
            return date
        }
        return value
    })
        deliveryDate: Date
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
        description:
            "File key for uploaded cover image (from generateUploadUrl)",
    })
    @IsOptional()
    @IsString({ message: "Cover image file key must be a string" })
    @IsNotEmpty({ message: "Cover image file key cannot be empty if provided" })
        coverImageFileKey?: string

    @Field(() => String, { nullable: true, description: "Campaign location" })
    @IsOptional()
    @IsString({ message: "Location must be a string" })
    @IsNotEmpty({ message: "Location cannot be empty if provided" })
        location?: string

    @Field(() => String, {
        nullable: true,
        description: "Target amount as string (BigInt compatible)",
    })
    @IsOptional()
    @IsString({ message: "Target amount must be a string" })
    @IsNotEmpty({ message: "Target amount cannot be empty if provided" })
        targetAmount?: string

    @Field(() => String, {
        nullable: true,
        description: "Ingredient budget percentage (0-100)",
    })
    @IsOptional()
    @IsNumberString(
        {},
        { message: "Ingredient budget percentage must be a number string" },
    )
        ingredientBudgetPercentage?: string

    @Field(() => String, {
        nullable: true,
        description: "Cooking budget percentage (0-100)",
    })
    @IsOptional()
    @IsNumberString(
        {},
        { message: "Cooking budget percentage must be a number string" },
    )
        cookingBudgetPercentage?: string

    @Field(() => String, {
        nullable: true,
        description: "Delivery budget percentage (0-100)",
    })
    @IsOptional()
    @IsNumberString(
        {},
        { message: "Delivery budget percentage must be a number string" },
    )
        deliveryBudgetPercentage?: string

    @Field(() => Date, {
        nullable: true,
        description: "Fundraising start date",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Fundraising start date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for fundraisingStartDate")
            }
            return date
        }
        return value
    })
        fundraisingStartDate?: Date

    @Field(() => Date, {
        nullable: true,
        description: "Fundraising end date (ISO 8601)",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Fundraising end date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for fundraisingEndDate")
            }
            return date
        }
        return value
    })
        fundraisingEndDate?: Date

    @Field(() => Date, {
        nullable: true,
        description: "Ingredient purchase date (ISO 8601)",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Ingredient purchase date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error(
                    "Invalid date format for ingredientPurchaseDate",
                )
            }
            return date
        }
        return value
    })
        ingredientPurchaseDate?: Date

    @Field(() => Date, {
        nullable: true,
        description: "Cooking date",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Cooking date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for cookingDate")
            }
            return date
        }
        return value
    })
        cookingDate?: Date

    @Field(() => Date, {
        nullable: true,
        description: "Delivery date (ISO 8601)",
    })
    @IsOptional()
    @Type(() => Date)
    @IsDate({ message: "Delivery date must be a valid date" })
    @Transform(({ value }) => {
        if (!value) return value
        if (typeof value === "string") {
            const date = new Date(value)
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date format for deliveryDate")
            }
            return date
        }
        return value
    })
        deliveryDate?: Date

    @Field(() => String, {
        nullable: true,
        description: "Campaign category ID",
    })
    @IsOptional()
    @IsUUID(4, { message: "Category ID must be a valid UUID" })
        categoryId?: string
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
