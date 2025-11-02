import {
    Resolver,
    Query,
    Args,
    ID,
    ResolveReference,
    Int,
} from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType } from "libs/auth"
import {
    UserApplicationService,
    OrganizationApplicationService,
} from "../../../application/services"
import {
    UserModel,
    UserHealthResponse,
    RoleProfileResponse,
    OrganizationListResponse,
    OrganizationWithMembers,
} from "../models"

/**
 * Presentation Resolver: User Query
 * Handles GraphQL queries for user operations
 */
@Resolver(() => UserModel)
export class UserQueryResolver {
    constructor(
        private readonly userApplicationService: UserApplicationService,
        private readonly organizationApplicationService: OrganizationApplicationService,
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

        const cognito_id = user.cognito_id || user.sub || user.id

        if (!cognito_id) {
            throw new Error("User cognito_id not found")
        }

        const userInfo =
            await this.userApplicationService.getUserByCognitoId(cognito_id)
        if (!userInfo) {
            throw new Error("User not found in database")
        }

        return {
            message: `Profile for ${userInfo.role.toLowerCase()} user`,
            userProfile: userInfo,
        }
    }

    @Query(() => UserModel, { nullable: true })
    async getUserById(@Args({ name: "id", type: () => ID }) id: string) {
        return this.userApplicationService.getUserById(id)
    }

    @Query(() => UserModel, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "cognitoId", type: () => ID }) cognitoId: string,
    ) {
        return this.userApplicationService.getUserByCognitoId(cognitoId)
    }

    @Query(() => UserModel, { nullable: true })
    async getUserByEmail(@Args("email") email: string) {
        return this.userApplicationService.getUserByEmail(email)
    }

    @Query(() => UserModel, { nullable: true })
    async getUserByUsername(@Args("username") username: string) {
        return this.userApplicationService.getUserByUsername(username)
    }

    @Query(() => [UserModel])
    async getAllUsers(
        @Args("skip", { nullable: true }) skip?: number,
        @Args("take", { nullable: true }) take?: number,
    ) {
        return this.userApplicationService.getAllUsers(skip, take)
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
        const safeLimit = Math.min(Math.max(limit, 1), 50)
        const safeOffset = Math.max(offset, 0)

        const result =
            await this.organizationApplicationService.getActiveOrganizationsWithMembers(
                {
                    offset: safeOffset,
                    limit: safeLimit,
                },
            )

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
        return this.organizationApplicationService.getOrganizationById(id)
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<any> {
        return this.userApplicationService.getUserById(reference.id)
    }
}
