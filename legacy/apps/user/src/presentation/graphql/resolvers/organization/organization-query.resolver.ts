import { Resolver, Query, Args, Int } from "@nestjs/graphql"
import { OrganizationService } from "@app/user/src/application/services"
import {
    OrganizationListResponse,
    OrganizationWithMembers,
} from "@app/user/src/shared/types"

@Resolver()
export class OrganizationQueryResolver {
    constructor(
        private readonly organizationService: OrganizationService,
    ) {}

    @Query(() => OrganizationListResponse, {
        name: "listActiveOrganizations",
        description: "List all active verified organizations (Public API - No authentication required)",
    })
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
        description: "Get organization details by ID (Public API - No authentication required, only verified organizations)",
    })
    async getOrganizationById(
        @Args("id", {
            description: "Organization ID",
        })
            id: string,
    ): Promise<OrganizationWithMembers> {
        return this.organizationService.getOrganizationById(id) as any
    }
}
