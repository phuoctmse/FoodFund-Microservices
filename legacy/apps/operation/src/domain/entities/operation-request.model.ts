import { Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, CampaignPhase, User } from "../../shared"
import { OperationExpenseType, OperationRequestStatus } from "../enums"
import { Organization } from "../../shared/model"

@ObjectType("OperationRequest")
export class OperationRequest extends BaseSchema {
    @Field(() => String, { description: "Campaign phase ID" })
        campaignPhaseId: string

    @Field(() => String, { description: "User ID who created this request" })
        userId: string

    @Field(() => String, {
        nullable: true,
        description: "Organization ID",
    })
        organizationId?: string

    @Field(() => String, { description: "Request title" })
        title: string

    @Field(() => String, {
        description: "Total cost in VND (as string to handle BigInt)",
    })
        totalCost: string

    @Field(() => OperationExpenseType, {
        description: "Expense type: COOKING or DELIVERY",
    })
        expenseType: OperationExpenseType

    @Field(() => OperationRequestStatus, {
        description: "Request status",
        defaultValue: OperationRequestStatus.PENDING,
    })
        status: OperationRequestStatus

    @Field(() => String, {
        nullable: true,
        description: "Admin note (required when rejected)",
    })
        adminNote?: string

    @Field(() => Date, {
        nullable: true,
        description: "Timestamp when status was last changed",
    })
        changedStatusAt?: Date

    @Field(() => User, { nullable: true })
        user?: User

    @Field(() => CampaignPhase, { nullable: true })
        campaignPhase?: CampaignPhase

    @Field(() => Organization, {
        nullable: true,
        description:
            "Organization bank info (for admin payment processing). Only accessible by admins.",
    })
        organization?: Organization
}
