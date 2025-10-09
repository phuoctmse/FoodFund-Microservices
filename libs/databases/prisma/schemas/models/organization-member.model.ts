import { ObjectType, Field, ID } from "@nestjs/graphql"
import { AbstractSchema } from "../abstract.schema"
import { VerificationStatus } from "../enums/user.enums"
import { Role } from "../enums/user.enums"
import { UserProfileSchema } from "./user-profiles.model"
import { OrganizationSchema } from "./organization.model"

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