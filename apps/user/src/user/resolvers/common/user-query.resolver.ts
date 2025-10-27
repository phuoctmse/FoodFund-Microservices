import {
    Resolver,
    Query,
    Args,
    ResolveReference,
    ObjectType,
    Field,
    Int,
} from "@nestjs/graphql"
import { UserHealthResponse } from "../../types/health-response.model"
import { OrganizationListResponse } from "../../types/organization-list-response.model"
import { OrganizationWithMembers } from "../../types/organization-with-members.model"
import { UserQueryService } from "../../services/common/user-query.service"
import { OrganizationService } from "../../services"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType } from "libs/auth"
import { UserProfileSchema } from "../../models/user.model"

@ObjectType()
export class RoleProfileResponse {
    @Field(() => String)
        message: string

    @Field(() => UserProfileSchema)
        userProfile: UserProfileSchema
}

@Resolver(() => UserProfileSchema)
export class UserQueryResolver {
    constructor(
        private readonly userQueryService: UserQueryService,
        private readonly organizationService: OrganizationService,
    ) {}

    @Query(() => UserHealthResponse, { name: "userHealth" })
    async userHealth(): Promise<UserHealthResponse> {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
        }
    }
    @Query(() => RoleProfileResponse, { name: "getMyProfile" })
    @UseGuards(CognitoGraphQLGuard)
    async getMyProfile(
        @CurrentUser() user: CurrentUserType,
    ): Promise<RoleProfileResponse> {
        if (!user) {
            throw new Error("User not authenticated")
        }

        // Try multiple sources for cognito_id
        const cognito_id = user.cognito_id || user.sub || user.id

        if (!cognito_id) {
            throw new Error("User cognito_id not found")
        }

        // Get user info to determine role
        const userInfo =
            await this.userQueryService.findUserByCognitoId(cognito_id)
        if (!userInfo) {
            throw new Error("User not found in database")
        }

        const role = userInfo.role
        const response: RoleProfileResponse = {
            message: `Profile for ${role.toLowerCase()} user`,
            userProfile: userInfo,
        }

        return response
    }

    @Query(() => OrganizationListResponse, { name: "listActiveOrganizations" })
    async listActiveOrganizations(
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of organizations to skip",
        })
            offset: number = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of organizations to return (max 50)",
        })
            limit: number = 10,
    ): Promise<OrganizationListResponse> {
        const safeLimit = Math.min(Math.max(limit, 1), 50) // Max 50 items per page
        const safeOffset = Math.max(offset, 0)

        const result =
            await this.organizationService.getActiveOrganizationsWithMembers({
                offset: safeOffset,
                limit: safeLimit,
            })

        return {
            success: true,
            message: `Found ${result.organizations.length} active organization(s) (page ${Math.floor(safeOffset / safeLimit) + 1})`,
            organizations: result.organizations,
            total: result.total,
            offset: safeOffset,
            limit: safeLimit,
            hasMore: safeOffset + safeLimit < result.total,
        }
    }

    @Query(() => OrganizationWithMembers, {
        name: "getOrganizationById",
        description:
            "Get organization details by ID (public access, only verified organizations)",
    })
    async getOrganizationById(
        @Args("id", {
            description: "Organization ID",
        })
            id: string,
    ) {
        return this.organizationService.getOrganizationById(id)
    }

    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userQueryService.resolveReference(reference)
    }
}
