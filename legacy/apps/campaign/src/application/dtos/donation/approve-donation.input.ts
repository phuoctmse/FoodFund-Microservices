import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator"

@InputType()
export class ApproveManualDonationInput {
    @Field(() => Int, {
        description: "Order code of the donation to approve",
    })
    @IsInt()
        orderCode: number

    @Field(() => String, {
        nullable: true,
        description: "Admin note explaining the approval reason",
    })
    @IsOptional()
    @IsString()
        adminNote?: string

    @Field(() => Boolean, {
        defaultValue: false,
        description:
            "Force approve even if there are validation errors (e.g., wrong amount/description)",
    })
    @IsBoolean()
        forceApprove: boolean
}
