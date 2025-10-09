import { ObjectType, Field, ID } from "@nestjs/graphql"
import { OrganizationSchema, UserProfileSchema } from "libs/databases/prisma/schemas"

@ObjectType()
export class OrganizationMemberInfo {
    @Field(() => ID)
        id: string

    @Field(() => UserProfileSchema)
        member: UserProfileSchema

    @Field(() => String)
        member_role: string

    @Field(() => String)
        status: string

    @Field(() => Date)
        joined_at: Date
}

@ObjectType()
export class OrganizationWithMembers extends OrganizationSchema {
    @Field(() => [OrganizationMemberInfo])
        members: OrganizationMemberInfo[]

    @Field(() => Number)
        total_members: number

    @Field(() => Number)
        active_members: number
}