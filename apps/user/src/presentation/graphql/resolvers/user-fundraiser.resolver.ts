import { Resolver, Mutation, Args, Query, Int } from "@nestjs/graphql"
import { CurrentUser, RequireRole, CurrentUserType } from "libs/auth"
import { Role } from "../../../domain/enums"
import { OrganizationApplicationService } from "../../../application/services"
import {
    OrganizationWithMembers,
    JoinRequestManagementResponse,
    JoinRequestListResponse,
    StaffRemovalResponse,
} from "../models"

/**
 * Presentation Resolver: Fundraiser Profile
 * Handles GraphQL operations for fundraiser-specific features
 */
@Resolver()
export class UserFundraiserResolver {
    constructor(
        private readonly organizationApplicationService: OrganizationApplicationService,
    ) {}

    @Query(() => OrganizationWithMembers, {
        description:
            "Get the organization that this fundraiser manages with all members",
        nullable: true,
    })
    @RequireRole(Role.FUNDRAISER)
    async myOrganization(@CurrentUser() user: CurrentUserType) {
        return this.organizationApplicationService.getFundraiserOrganization(
            user.cognito_id,
        )
    }

    @Query(() => JoinRequestListResponse)
    @RequireRole(Role.FUNDRAISER)
    async getOrganizationJoinRequests(
        @CurrentUser() user: CurrentUserType,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of join requests to skip",
        })
            offset: number = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of join requests to return (max 50)",
        })
            limit: number = 10,
        @Args("status", {
            type: () => String,
            nullable: true,
            description: "Filter by status: PENDING, VERIFIED, REJECTED",
        })
            status?: string,
    ) {
        const safeLimit = Math.min(Math.max(limit, 1), 50)
        const safeOffset = Math.max(offset, 0)

        const result =
            await this.organizationApplicationService.getMyOrganizationJoinRequests(
                user.cognito_id,
                {
                    offset: safeOffset,
                    limit: safeLimit,
                    status,
                },
            )

        return {
            success: true,
            message: `Found ${result.joinRequests.length} join request(s) for your organization (page ${Math.floor(safeOffset / safeLimit) + 1})`,
            joinRequests: result.joinRequests,
            total: result.total,
            offset: safeOffset,
            limit: safeLimit,
            hasMore: safeOffset + safeLimit < result.total,
        }
    }

    @Mutation(() => JoinRequestManagementResponse)
    @RequireRole(Role.FUNDRAISER)
    async approveJoinRequest(
        @CurrentUser() user: CurrentUserType,
        @Args("requestId") requestId: string,
    ) {
        const result =
            await this.organizationApplicationService.approveJoinRequest(
                requestId,
                user.cognito_id,
            )
        return {
            success: true,
            message: `Join request approved successfully. User "${result.member.full_name}" is now a member.`,
            joinRequest: result,
            requestId: result.id,
        }
    }

    @Mutation(() => JoinRequestManagementResponse)
    @RequireRole(Role.FUNDRAISER)
    async rejectJoinRequest(
        @CurrentUser() user: CurrentUserType,
        @Args("requestId") requestId: string,
    ) {
        const result =
            await this.organizationApplicationService.rejectJoinRequest(
                requestId,
                user.cognito_id,
            )
        return {
            success: true,
            message: "Join request rejected successfully.",
            joinRequest: result,
            requestId: result.id,
        }
    }

    @Mutation(() => StaffRemovalResponse, {
        description:
            "Remove a staff member from the organization (Fundraiser only)",
    })
    @RequireRole(Role.FUNDRAISER)
    async removeStaffMember(
        @CurrentUser() user: CurrentUserType,
        @Args("memberId", {
            description: "ID of the organization member to remove",
        })
            memberId: string,
    ) {
        return this.organizationApplicationService.removeStaffMember(
            memberId,
            user.cognito_id,
        )
    }
}
