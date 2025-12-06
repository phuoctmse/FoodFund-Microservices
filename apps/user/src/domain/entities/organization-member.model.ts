import { ObjectType, Field, ID } from "@nestjs/graphql"
import { OrganizationSchema } from "./organization.model"
import { Role, VerificationStatus } from "../enums/user.enum"
import { UserProfileSchema } from "./user.model"

@ObjectType()
export class OrganizationMemberSchema {
    @Field(() => ID, {
        description: "Unique identifier",
    })
        id: string

    @Field(() => String, {
        description: "Organization ID",
    })
        organization_id: string

    @Field(() => String, {
        description: "Member user ID",
    })
        member_id: string

    @Field(() => Role, {
        description: "Member role in organization",
    })
        member_role: Role

    @Field(() => VerificationStatus, {
        description: "Membership status",
    })
        status: VerificationStatus

    @Field(() => Date, {
        description: "Join date",
    })
        joined_at: Date

    @Field(() => UserProfileSchema, {
        description: "Member user information",
        nullable: true,
    })
        member?: UserProfileSchema

    @Field(() => OrganizationSchema, {
        description: "Organization information",
        nullable: true,
    })
        organization?: OrganizationSchema

    __typename?: string
}
