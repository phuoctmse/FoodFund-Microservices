import { ObjectType, Field } from "@nestjs/graphql"
import { OrganizationSchema } from "libs/databases/prisma/schemas"

@ObjectType()
export class OrganizationActionResponse {
    @Field(() => OrganizationSchema, {
        description: "The organization that was processed",
    })
        organization: OrganizationSchema

    @Field(() => String, {
        description: "Success message about the action",
    })
        message: string

    @Field(() => Boolean, {
        description: "Whether the action was successful",
    })
        success: boolean
}