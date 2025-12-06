import { ObjectType, Field, ID } from "@nestjs/graphql"
import { OrganizationMemberSchema } from "../../domain/entities"

@ObjectType()
export class JoinRequestManagementResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => OrganizationMemberSchema, { nullable: true })
        joinRequest?: OrganizationMemberSchema

    @Field(() => ID, { nullable: true })
        requestId?: string
}

@ObjectType()
export class JoinRequestListResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [OrganizationMemberSchema])
        joinRequests: OrganizationMemberSchema[]

    @Field(() => Number)
        total: number

    @Field(() => Number, { nullable: true })
        offset?: number

    @Field(() => Number, { nullable: true })
        limit?: number

    @Field(() => Boolean, { nullable: true })
        hasMore?: boolean
}
