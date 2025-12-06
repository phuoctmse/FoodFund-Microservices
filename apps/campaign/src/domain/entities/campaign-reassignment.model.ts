import { Field, ObjectType } from "@nestjs/graphql"
import { Organization } from "../../shared/model"
import { Campaign } from "./campaign.model"
import { BaseSchema } from "../../shared"
import { CampaignReassignmentStatus } from "../enums/campaign/campaign-reassignment-status.enum"

@ObjectType("CampaignReassignment")
export class CampaignReassignment extends BaseSchema {
    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => String, { description: "Organization ID being assigned to" })
        organizationId: string

    @Field(() => CampaignReassignmentStatus, { description: "Current status" })
        status: CampaignReassignmentStatus

    @Field(() => Date, { description: "When the assignment was created" })
        assignedAt: Date

    @Field(() => Date, { description: "When the assignment expires (7 days)" })
        expiresAt: Date

    @Field(() => Date, {
        nullable: true,
        description: "When fundraiser responded",
    })
        respondedAt?: Date

    @Field(() => String, { nullable: true, description: "Response note" })
        responseNote?: string

    @Field(() => Campaign, {
        nullable: true,
    })
        campaign?: Campaign

    @Field(() => Organization, {
        nullable: true,
    })
        organization: Organization
}