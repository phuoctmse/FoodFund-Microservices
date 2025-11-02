import { ObjectType, Field, ID } from "@nestjs/graphql"
import { Role, VerificationStatus } from "../../../domain/enums"
import { UserModel } from "./user.model"
import { OrganizationModel } from "./organization.model"

/**
 * GraphQL Model: Organization Member
 * Represents a member of an organization
 */
@ObjectType()
export class OrganizationMemberModel {
    @Field(() => ID, { description: "Unique identifier" })
        id: string

    @Field(() => String, { description: "Organization ID" })
        organization_id: string

    @Field(() => String, { description: "Member user ID" })
        member_id: string

    @Field(() => Role, { description: "Member role in organization" })
        member_role: Role

    @Field(() => VerificationStatus, { description: "Membership status" })
        status: VerificationStatus

    @Field(() => Date, { description: "Join date" })
        joined_at: Date

    @Field(() => UserModel, {
        description: "Member user information",
        nullable: true,
    })
        member?: UserModel

    @Field(() => OrganizationModel, {
        description: "Organization information",
        nullable: true,
    })
        organization?: OrganizationModel
}
