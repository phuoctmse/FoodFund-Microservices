import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, CampaignPhase, User } from "../../shared"
import { IngredientRequestStatus } from "../enums"
import { IngredientRequestItem } from "./ingredient-request-item.model"
import { Organization } from "../../shared/model"

@ObjectType("IngredientRequest")
@Directive("@key(fields: \"id\")")
export class IngredientRequest extends BaseSchema {
    @Field(() => String, {
        description: "Campaign phase ID this request belongs to",
    })
        campaignPhaseId: string

    @Field(() => String, {
        description: "Kitchen staff user ID who created the request",
    })
        kitchenStaffId: string

    @Field(() => String, {
        nullable: true,
        description: "Organization ID",
    })
        organizationId?: string

    @Field(() => String, {
        description: "Total cost of all items (in VND)",
    })
        totalCost: string

    @Field(() => IngredientRequestStatus, {
        description: "Current status of the request",
    })
        status: IngredientRequestStatus

    @Field(() => Date, {
        nullable: true,
        description: "Timestamp when status was last changed",
    })
        changedStatusAt?: Date

    @Field(() => [IngredientRequestItem], {
        description: "List of ingredient items in this request",
    })
        items: IngredientRequestItem[]

    @Field(() => User, {
        nullable: true,
        description:
            "Kitchen staff who created this request (resolved from User service)",
    })
        kitchenStaff?: User

    @Field(() => CampaignPhase, {
        nullable: true,
        description:
            "Campaign phase this request belongs to (resolved from Campaign service)",
    })
        campaignPhase?: CampaignPhase

    @Field(() => Organization, {
        nullable: true,
        description:
            "Organization bank info (for admin payment processing). Only accessible by admins.",
    })
        organization?: Organization

    constructor() {
        super()
    }
}
