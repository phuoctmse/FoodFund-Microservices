import { Field, Float, InputType, Int, registerEnumType } from "@nestjs/graphql"
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, IsNotEmpty } from "class-validator"

export enum DonationSortBy {
    NEWEST = "NEWEST",
    OLDEST = "OLDEST",
    HIGHEST_AMOUNT = "HIGHEST_AMOUNT",
    LOWEST_AMOUNT = "LOWEST_AMOUNT",
}

registerEnumType(DonationSortBy, {
    name: "DonationSortBy",
})

@InputType()
export class SearchDonationInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        query?: string // Search by donor name or order code

    @Field(() => String)
    @IsNotEmpty()
    @IsUUID()
        campaignId: string

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
        minAmount?: number

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
        maxAmount?: number

    @Field(() => DonationSortBy, { nullable: true })
    @IsOptional()
    @IsEnum(DonationSortBy)
        sortBy?: DonationSortBy

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        status?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        donorEmail?: string

    @Field(() => Date, { nullable: true })
    @IsOptional()
        startDate?: Date

    @Field(() => Date, { nullable: true })
    @IsOptional()
        endDate?: Date

    @Field(() => Int, { defaultValue: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
        page: number

    @Field(() => Int, { defaultValue: 10 })
    @IsOptional()
    @IsInt()
    @Min(1)
        limit: number
}
