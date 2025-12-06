import { ObjectType, Field, Int } from "@nestjs/graphql"
import { OrganizationWithMembers } from "./organization-with-members.model"

@ObjectType()
export class OrganizationListResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [OrganizationWithMembers])
        organizations: OrganizationWithMembers[]

    @Field(() => Int)
        total: number

    @Field(() => Int, { nullable: true })
        offset?: number

    @Field(() => Int, { nullable: true })
        limit?: number

    @Field(() => Boolean, { nullable: true })
        hasMore?: boolean
}
