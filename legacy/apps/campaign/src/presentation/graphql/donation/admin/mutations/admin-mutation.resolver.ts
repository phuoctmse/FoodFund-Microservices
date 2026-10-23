import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { RequireRole, CurrentUserType } from "@libs/auth"
import { CurrentUser } from "@app/campaign/src/shared"
import { Role } from "@app/campaign/src/shared/types/user-context.type"
import { DonationAdminService } from "@app/campaign/src/application/services/donation/admin"
import { ApproveDonationResponse } from "@app/campaign/src/domain/entities/failed-donation.model"
import { ApproveManualDonationInput } from "@app/campaign/src/application/dtos/donation"

@Resolver()
export class AdminMutationResolver {
    constructor(private readonly donationAdminService: DonationAdminService) {}

    @Mutation(() => ApproveDonationResponse, {
        description: "Manually approve a failed donation",
    })
    @RequireRole(Role.ADMIN)
    async approveManualDonation(
        @Args("input") input: ApproveManualDonationInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<ApproveDonationResponse> {
        return this.donationAdminService.approveManualDonation(
            input,
            user.username,
        )
    }
}
