import { Args, Mutation, Resolver, ID, Query, Int } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { RequireRole } from "libs/auth"
import { Role } from "../../../domain/enums"
import {
    UserApplicationService,
    OrganizationApplicationService,
} from "../../../application/services"
import { UserModel } from "../models"
import { UpdateUserAccountInput } from "../inputs"
import {
    OrganizationActionResponse,
    OrganizationModel,
} from "../models"

/**
 * Presentation Resolver: User Admin
 * Handles GraphQL operations for admin user management
 */
@Resolver()
export class UserAdminResolver {
    constructor(
        private readonly userApplicationService: UserApplicationService,
        private readonly organizationApplicationService: OrganizationApplicationService,
    ) {}

    @Query(() => [UserModel], { name: "getAllUsers" })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.ADMIN)
    async getAllUsers(
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of users to skip",
        })
            offset: number = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of users to return (max 100)",
        })
            limit: number = 10,
    ) {
        const safeLimit = Math.min(Math.max(limit, 1), 100)
        const safeOffset = Math.max(offset, 0)

        return this.userApplicationService.getAllUsers(safeOffset, safeLimit)
    }

    @Mutation(() => UserModel)
    @RequireRole(Role.ADMIN)
    async updateUserAccount(
        @Args("userId", { type: () => ID }) userId: string,
        @Args("input", new ValidationPipe()) input: UpdateUserAccountInput,
    ) {
        return this.userApplicationService.updateUser(userId, input)
    }

    // Organization management methods
    @Query(() => [OrganizationModel])
    @RequireRole(Role.ADMIN)
    async getAllOrganizationRequests(
        @Args("status", {
            type: () => String,
            nullable: true,
            description: "Filter by status: PENDING, VERIFIED, REJECTED",
        })
            status?: string,
        @Args("sortBy", {
            type: () => String,
            nullable: true,
            defaultValue: "created_at",
            description: "Sort by field: created_at, name, status",
        })
            sortBy: string = "created_at",
        @Args("sortOrder", {
            type: () => String,
            nullable: true,
            defaultValue: "desc",
            description: "Sort order: asc, desc",
        })
            sortOrder: string = "desc",
    ) {
        const organizations =
            await this.organizationApplicationService.getAllOrganizationRequests(
                {
                    status,
                    sortBy,
                    sortOrder,
                },
            )
        return organizations
    }

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.ADMIN)
    async approveOrganizationRequest(
        @Args("organizationId") organizationId: string,
    ) {
        const result =
            await this.organizationApplicationService.approveOrganizationRequest(
                organizationId,
            )
        return {
            organization: result,
            message: `Organization "${result.name}" has been approved successfully. Representative role updated to FUNDRAISER.`,
            success: true,
        }
    }

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.ADMIN)
    async rejectOrganizationRequest(
        @Args("organizationId") organizationId: string,
    ) {
        const result =
            await this.organizationApplicationService.rejectOrganizationRequest(
                organizationId,
            )
        return {
            organization: result,
            message: `Organization "${result.name}" has been rejected.`,
            success: true,
        }
    }
}
