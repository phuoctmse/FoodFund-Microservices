import { Field, Float, InputType, Int, registerEnumType } from "@nestjs/graphql"
import { CampaignStatus } from "../../../../domain/enums/campaign/campaign.enum"
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator"

export enum CampaignSortBy {
    NEWEST = "NEWEST",
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST = "OLDEST",
    OLDEST_FIRST = "OLDEST_FIRST",
    MOST_FUNDED = "MOST_FUNDED",
    LEAST_FUNDED = "LEAST_FUNDED",
    ENDING_SOON = "ENDING_SOON",
    TARGET_AMOUNT_ASC = "TARGET_AMOUNT_ASC",
    TARGET_AMOUNT_DESC = "TARGET_AMOUNT_DESC",
    MOST_DONATED = "MOST_DONATED",
    LEAST_DONATED = "LEAST_DONATED",
    ACTIVE_FIRST = "ACTIVE_FIRST",
}

registerEnumType(CampaignSortBy, {
    name: "CampaignSortBy",
})

@InputType()
export class SearchCampaignInput {
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        query?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
        categoryId?: string

    @Field(() => String, { nullable: true })
    @IsOptional()
        creatorId?: string

    @Field(() => [CampaignStatus], { nullable: true })
    @IsOptional()
    @IsEnum(CampaignStatus, { each: true })
        status?: CampaignStatus[]

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
        minTargetAmount?: number

    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
        maxTargetAmount?: number

    @Field(() => CampaignSortBy, { nullable: true })
    @IsOptional()
    @IsEnum(CampaignSortBy)
        sortBy?: CampaignSortBy

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
