import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, CampaignPhase, User } from "../../shared"
import { IngredientRequestStatus } from "../enums"
import { IngredientRequestItem } from "./ingredient-request-item.model"

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

    constructor() {
        super()
    }
}
