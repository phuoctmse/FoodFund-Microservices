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
    CreateStaffAccountInput,
    UpdateUserAccountInput,
} from "../../dto/user.input"
import { RequireRole } from "libs/auth"
import { Role, UserProfileSchema, OrganizationSchema } from "libs/databases/prisma/schemas"
import { UserAdminService } from "../../services/admin/user-admin.service"
import { OrganizationService } from "../../services/organization/organization.service"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver()
export class UserAdminResolver {
    constructor(
        private userAdminService: UserAdminService,
        private organizationService: OrganizationService,
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
    async getPendingOrganizationRequests() {
        const organizations = await this.organizationService.getPendingOrganizationRequests()
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
