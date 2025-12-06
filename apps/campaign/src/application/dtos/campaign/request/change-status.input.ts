import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { Field, InputType } from "@nestjs/graphql"
import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator"

@InputType()
export class ChangeStatusInput {
    @Field(() => String)
    @IsNotEmpty({ message: "Campaign ID is required" })
    @IsString({ message: "Campaign ID must be a string" })
        campaignId: string

    @Field(() => CampaignStatus)
    @IsNotEmpty({ message: "Status is required" })
    @IsEnum(CampaignStatus, { message: "Invalid campaign status" })
        newStatus: CampaignStatus

    @Field(() => String, {
        nullable: true,
        description: "Reason for rejection or cancellation",
    })
    @IsOptional()
    @IsString({ message: "Reason must be a string" })
    @MaxLength(500, { message: "Reason must not exceed 500 characters" })
        reason?: string
}
