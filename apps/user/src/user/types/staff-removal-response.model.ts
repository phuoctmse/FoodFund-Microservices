import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class RemovedMemberInfo {
    @Field(() => String, { description: "User ID of the removed member" })
        id: string

    @Field(() => String, { description: "Full name of the removed member" })
        name: string

    @Field(() => String, { description: "Email of the removed member" })
        email: string

    @Field(() => String, {
        description: "Previous role of the member (KITCHEN_STAFF, DELIVERY_STAFF)",
    })
        role: string
}

@ObjectType()
export class StaffRemovalResponse {
    @Field(() => Boolean, { description: "Whether the operation was successful" })
        success: boolean

    @Field(() => String, { description: "Success or error message" })
        message: string

    @Field(() => RemovedMemberInfo, {
        description: "Information about the removed member",
    })
        removedMember: RemovedMemberInfo
}
