import { ObjectType, Field } from "@nestjs/graphql"
import { OrganizationSchema } from "../models/organization.model"

@ObjectType()
export class JoinRequestResponse {
    @Field(() => String, {
        description: "The join request ID",
    })
        id: string

    @Field(() => OrganizationSchema, {
        description: "The organization being joined",
    })
        organization: OrganizationSchema

    @Field(() => String, {
        description: "The requested role for joining",
    })
        requested_role: string

    @Field(() => String, {
        description: "Current status of the join request",
    })
        status: string

    @Field(() => String, {
        description: "Success message about the join request",
    })
        message: string

    @Field(() => Boolean, {
        description: "Whether the request was successful",
    })
        success: boolean
}
