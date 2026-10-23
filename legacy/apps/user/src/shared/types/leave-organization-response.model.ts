import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class PreviousOrganizationInfo {
    @Field(() => String, { description: "Organization ID" })
        id: string

    @Field(() => String, { description: "Organization name" })
        name: string
}

@ObjectType()
export class LeaveOrganizationResponse {
    @Field(() => Boolean, {
        description: "Whether the operation was successful",
    })
        success: boolean

    @Field(() => String, { description: "Success or error message" })
        message: string

    @Field(() => PreviousOrganizationInfo, {
        description: "Information about the organization you left",
    })
        previousOrganization: PreviousOrganizationInfo

    @Field(() => String, {
        description: "Your previous role (KITCHEN_STAFF or DELIVERY_STAFF)",
    })
        previousRole: string

    @Field(() => Boolean, {
        description:
            "Whether user needs to re-login to get new access token with updated role",
    })
        requiresReLogin: boolean
}
