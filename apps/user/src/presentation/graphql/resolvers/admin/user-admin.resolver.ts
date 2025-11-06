import { Args, Mutation, Resolver, ID, Query, Int } from "@nestjs/graphql"

import { RequireRole } from "libs/auth"

import { UseGuards, ValidationPipe } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { UpdateUserAccountInput } from "@app/user/src/application/dtos"
import {
    UserAdminService,
    OrganizationService,
} from "@app/user/src/application/services"
import {
    UserProfileSchema,
    OrganizationSchema,
} from "@app/user/src/domain/entities"
import { OrganizationActionResponse } from "@app/user/src/shared/types"
import { Role } from "@libs/databases"

@Resolver()
export class UserAdminResolver {
    constructor(
        private readonly userAdminService: UserAdminService,
        private readonly organizationService: OrganizationService,
    ) {}

    // Admin Query: Get all users
    @Query(() => [UserProfileSchema], { name: "getAllUsers" })
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

        return this.userAdminService.getAllUsers(safeOffset, safeLimit)
    }

    @Mutation(() => UserProfileSchema)
    @RequireRole(Role.ADMIN)
    async updateUserAccount(
        @Args("userId", { type: () => ID }) userId: string,
        @Args("input", new ValidationPipe()) input: UpdateUserAccountInput,
    ) {
        return this.userAdminService.updateUserAccount(userId, input) as any
    }

    // Organization management methods
    @Query(() => [OrganizationSchema])
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
            await this.organizationService.getAllOrganizationRequests({
                status,
                sortBy,
                sortOrder,
            })
        return organizations
    }

    @Mutation(() => OrganizationActionResponse)
    @RequireRole(Role.ADMIN)
    async approveOrganizationRequest(
        @Args("organizationId") organizationId: string,
    ) {
        const result =
            await this.organizationService.approveOrganizationRequest(
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
            await this.organizationService.rejectOrganizationRequest(
                organizationId,
            )
        return {
            organization: result,
            message: `Organization "${result.name}" has been rejected.`,
            success: true,
        }
    }
}
