import { Args, Mutation, Resolver, Query } from "@nestjs/graphql"
import { RequireRole } from "libs/auth"
import { OrganizationService } from "@app/user/src/application/services"
import { OrganizationSchema } from "@app/user/src/domain/entities"
import { OrganizationActionResponse } from "@app/user/src/shared/types"
import { Role } from "@libs/databases"

@Resolver()
export class OrganizationAdminResolver {
    constructor(
        private readonly organizationService: OrganizationService,
    ) {}

    @Query(() => [OrganizationSchema], {
        description: "Get all organization requests with filtering and sorting (Admin only)",
    })
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

    @Mutation(() => OrganizationActionResponse, {
        description: "Approve organization creation request (Admin only)",
    })
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

    @Mutation(() => OrganizationActionResponse, {
        description: "Reject organization creation request with reason (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async rejectOrganizationRequest(
        @Args("organizationId") organizationId: string,
        @Args("reason", { type: () => String }) reason: string,
    ) {
        const result =
            await this.organizationService.rejectOrganizationRequest(
                organizationId,
                reason,
            )
        return {
            organization: result,
            message: `Organization "${result.name}" has been rejected. Reason: ${reason}`,
            success: true,
        }
    }
}
