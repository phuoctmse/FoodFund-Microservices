import { Field, InputType } from "@nestjs/graphql"
import { IsArray, IsNotEmpty, IsString, IsUUID, ArrayMinSize } from "class-validator"

@InputType()
export class AssignCampaignToOrganizationsInput {
    @Field(() => String, { description: "Campaign ID to reassign" })
    @IsNotEmpty()
    @IsUUID()
        campaignId: string

    @Field(() => [String], {
        description: "Organization IDs to assign the campaign to",
    })
    @IsArray()
    @ArrayMinSize(1, { message: "At least one organization must be selected" })
    @IsUUID("4", { each: true })
        organizationIds: string[]

    @Field(() => String, {
        nullable: true,
        description: "Reason for reassignment",
    })
    @IsString()
        reason?: string
}