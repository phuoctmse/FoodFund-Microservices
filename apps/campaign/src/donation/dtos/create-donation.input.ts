import { Field, InputType } from "@nestjs/graphql"
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsBoolean,
    Min,
    IsUUID,
    Max,
} from "class-validator"
import { Transform } from "class-transformer"

@InputType()
export class CreateDonationInput {
    @Field(() => String, { description: "ID of campaign to donate to" })
    @IsNotEmpty({ message: "Campaign ID is required" })
    @IsUUID("all", { message: "Campaign ID must be a valid UUID" })
        campaignId: string

    @Field(() => Number, { description: "Donation amount" })
    @IsNotEmpty({ message: "Amount is required" })
    @Min(1000, { message: "Minimum donation amount is 1,000 VND" })
    @Max(500000000, { message: "Maximum donation amount is 500,000,000 VND" })
        amount: number

    @Field(() => Boolean, {
        defaultValue: false,
        description: "Whether donation should be anonymous",
    })
    @IsOptional()
    @IsBoolean({ message: "isAnonymous must be a boolean" })
        isAnonymous?: boolean
}
