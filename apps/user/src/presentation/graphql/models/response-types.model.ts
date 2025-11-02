import { ObjectType, Field, Int } from "@nestjs/graphql"
import { UserModel } from "./user.model"
import { OrganizationModel } from "./organization.model"
import { OrganizationWithMembers } from "./organization-with-members.model"
import { OrganizationMemberModel } from "./organization-member.model"

/**
 * GraphQL Response: Health Check
 */
@ObjectType()
export class UserHealthResponse {
    @Field()
        status: string

    @Field()
        service: string

    @Field()
        timestamp: string
}

/**
 * GraphQL Response: Role Profile
 */
@ObjectType()
export class RoleProfileResponse {
    @Field(() => String)
        message: string

    @Field(() => UserModel)
        userProfile: UserModel
}

/**
 * GraphQL Response: Organization List
 */
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

/**
 * GraphQL Response: Organization Action
 */
@ObjectType()
export class OrganizationActionResponse {
    @Field(() => OrganizationModel, {
        description: "The organization that was processed",
    })
        organization: OrganizationModel

    @Field(() => String, {
        description: "Success message about the action",
    })
        message: string

    @Field(() => Boolean, {
        description: "Whether the action was successful",
    })
        success: boolean
}

/**
 * GraphQL Response: Leave Organization
 */
@ObjectType()
export class PreviousOrganizationInfo {
    @Field(() => String, { description: "Organization ID" })
        id: string

    @Field(() => String, { description: "Organization name" })
        name: string
}

@ObjectType()
export class LeaveOrganizationResponse {
    @Field(() => Boolean, {
        description: "Whether the operation was successful",
    })
        success: boolean

    @Field(() => String, { description: "Success or error message" })
        message: string

    @Field(() => PreviousOrganizationInfo, {
        description: "Information about the organization you left",
    })
        previousOrganization: PreviousOrganizationInfo

    @Field(() => String, {
        description: "Your previous role (KITCHEN_STAFF or DELIVERY_STAFF)",
    })
        previousRole: string
}

/**
 * GraphQL Response: Join Request
 */
@ObjectType()
export class JoinRequestResponse {
    @Field(() => String)
        id: string

    @Field(() => OrganizationModel)
        organization: OrganizationModel

    @Field(() => String)
        requested_role: string

    @Field(() => String)
        status: string

    @Field(() => String)
        message: string

    @Field(() => Boolean)
        success: boolean
}

/**
 * GraphQL Response: Cancel Join Request
 */
@ObjectType()
export class CancelJoinRequestResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        organizationName?: string
}

/**
 * GraphQL Response: Join Request Management
 */
@ObjectType()
export class JoinRequestManagementResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => OrganizationMemberModel)
        joinRequest: OrganizationMemberModel

    @Field(() => String)
        requestId: string
}

/**
 * GraphQL Response: Join Request List
 */
@ObjectType()
export class JoinRequestListResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [OrganizationMemberModel])
        joinRequests: OrganizationMemberModel[]

    @Field(() => Int)
        total: number

    @Field(() => Int)
        offset: number

    @Field(() => Int)
        limit: number

    @Field(() => Boolean)
        hasMore: boolean
}

/**
 * GraphQL Response: Staff Removal
 */
@ObjectType()
export class StaffRemovalResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String)
        removedMemberId: string

    @Field(() => String)
        removedMemberName: string

    @Field(() => String)
        previousRole: string
}
