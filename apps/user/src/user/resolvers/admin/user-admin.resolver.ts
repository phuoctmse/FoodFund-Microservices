import {
    Args,
    Mutation,
    Resolver,
    Context,
    ID,
    Query,
    Int,
} from "@nestjs/graphql"
import { CreateStaffAccountResponse } from "../../types/staff-response.model"
import { OrganizationActionResponse } from "../../types/organization-response.model"
import {
    UpdateUserAccountInput,
} from "../../dto/user.input"
import { RequireRole, CurrentUserType } from "libs/auth"
import { Role, UserProfileSchema, OrganizationSchema } from "libs/databases/prisma/schemas"
import { UserAdminService } from "../../services/admin/user-admin.service"
import { OrganizationService } from "../../services/organization/organization.service"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver()
export class UserAdminResolver {
    constructor(
        private readonly userAdminService: UserAdminService,
        private readonly organizationService: OrganizationService,
    ) {}

    // Admin Query: Get all users
    @Query(() => [UserProfileSchema], { name: "getAllUsers" })
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
        const organizations = await this.organizationService.getAllOrganizationRequests({
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
        const result = await this.organizationService.approveOrganizationRequest(organizationId)
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
        const result = await this.organizationService.rejectOrganizationRequest(organizationId)
        return {
            organization: result,
            message: `Organization "${result.name}" has been rejected.`,
            success: true,
        }
    }
}
