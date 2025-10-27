import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { RequireRole } from "@libs/auth"
import { Role } from "@app/campaign/src/shared/types/user-context.type"
import { FailedDonationModel, DonationDetailsModel } from "../../../models"
import { DonationAdminService } from "../../../services/admin"

@Resolver()
export class AdminQueryResolver {
    constructor(private readonly donationAdminService: DonationAdminService) {}

    @Query(() => [FailedDonationModel], {
        description: "Get list of failed donations for admin review",
    })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.ADMIN)
    async failedDonations(
        @Args("skip", { type: () => Int, nullable: true }) skip?: number,
        @Args("take", { type: () => Int, nullable: true }) take?: number,
    ): Promise<FailedDonationModel[]> {
        return this.donationAdminService.getFailedDonations({
            skip,
            take,
        })
    }

    @Query(() => DonationDetailsModel, {
        description: "Get donation details for admin review",
    })
    @UseGuards(CognitoGraphQLGuard)
    @RequireRole(Role.ADMIN)
    async donationDetails(
        @Args("orderCode", { type: () => String }) orderCode: string,
    ): Promise<DonationDetailsModel> {
        return this.donationAdminService.getDonationDetails(orderCode)
    }
}
