import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { RequireRole } from "@libs/auth"
import { Role } from "@app/campaign/src/shared/types/user-context.type"
import { DonationAdminService } from "../../../services/admin"
import { DonationDashboard } from "../../../dtos/admin/donation-statistics.dto"
import { AdminDonationsResponse } from "../../../dtos/admin/admin-donations-response.dto"
import { AdminDonationFilterInput } from "../../../dtos/admin/admin-donation-filter.input"

@Resolver()
export class AdminQueryResolver {
    constructor(private readonly donationAdminService: DonationAdminService) {}

    @Query(() => DonationDashboard, {
        description: "Get donation dashboard statistics for admin",
    })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.ADMIN)
    async donationDashboard(): Promise<DonationDashboard> {
        return this.donationAdminService.getDashboardStatistics()
    }

    @Query(() => AdminDonationsResponse, {
        description: "Get all donations with filters for admin",
    })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.ADMIN)
    async adminGetAllDonations(
        @Args("skip", { type: () => Int, nullable: true }) skip?: number,
        @Args("take", { type: () => Int, nullable: true }) take?: number,
        @Args("filter", {
            type: () => AdminDonationFilterInput,
            nullable: true,
        })
            filter?: AdminDonationFilterInput,
    ): Promise<AdminDonationsResponse> {
        return this.donationAdminService.getAllDonations({
            status: filter?.status,
            campaignId: filter?.campaignId,
            searchDonorName: filter?.searchDonorName,
            startDate: filter?.startDate,
            endDate: filter?.endDate,
            minAmount: filter?.minAmount,
            maxAmount: filter?.maxAmount,
            sortBy: filter?.sortBy,
            sortOrder: filter?.sortOrder,
            skip: skip ?? 0,
            take: take ?? 50,
        })
    }
}
