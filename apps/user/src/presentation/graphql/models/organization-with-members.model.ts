import { ObjectType, Field, ID } from "@nestjs/graphql"
import { UserModel } from "./user.model"
import { OrganizationModel } from "./organization.model"

/**
 * GraphQL Model: Organization Member Info
 * Simplified member information for organization listings
 */
@ObjectType()
export class OrganizationMemberInfo {
    @Field(() => ID)
        id: string

    @Field(() => UserModel)
        member: UserModel

    @Field(() => String)
        member_role: string

    @Field(() => String)
        status: string

    @Field(() => Date)
        joined_at: Date
}

/**
 * GraphQL Model: Organization With Members
 * Organization with its members list
 */
@ObjectType()
export class OrganizationWithMembers extends OrganizationModel {
    @Field(() => [OrganizationMemberInfo])
        members: OrganizationMemberInfo[]

    @Field(() => Number)
        total_members: number

    @Field(() => Number)
        active_members: number
}
