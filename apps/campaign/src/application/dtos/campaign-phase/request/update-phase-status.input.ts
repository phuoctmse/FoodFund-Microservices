import { CampaignPhaseStatus } from "@app/campaign/src/domain/enums/campaign-phase/campaign-phase.enum"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsEnum, IsNotEmpty, IsString } from "class-validator"

@InputType()
export class UpdatePhaseStatusInput {
    @Field(() => ID, {
        description: "Campaign phase ID to update",
    })
    @IsNotEmpty({ message: "Phase ID is required" })
    @IsString()
        phaseId: string

    @Field(() => CampaignPhaseStatus, {
        description: "New phase status (COMPLETED, CANCELLED, or FAILED)",
    })
    @IsNotEmpty({ message: "Status is required" })
    @IsEnum(CampaignPhaseStatus, {
        message: `Status must be one of: ${Object.values(CampaignPhaseStatus).join(", ")}`,
    })
        status: CampaignPhaseStatus
}