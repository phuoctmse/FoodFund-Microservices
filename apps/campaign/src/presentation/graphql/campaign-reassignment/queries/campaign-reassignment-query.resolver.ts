import { EligibleOrganizationsResponse } from "@app/campaign/src/application/dtos/campaign-reassignment/response"
import { CampaignReassignmentService } from "@app/campaign/src/application/services/campaign-reassignment"
import { CampaignReassignment } from "@app/campaign/src/domain/entities/campaign-reassignment.model"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { SentryInterceptor } from "@libs/observability"
import { UseGuards, UseInterceptors } from "@nestjs/common"
import { Args, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => CampaignReassignment)
@UseInterceptors(SentryInterceptor)
export class ReassignmentQueryResolver {
    constructor(
        private readonly reassignmentService: CampaignReassignmentService,
    ) {}

    @Query(() => EligibleOrganizationsResponse, {
        description:
            "Get organizations eligible to receive cancelled campaign (Admin only)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getEligibleOrganizationsForReassignment(
        @Args("campaignId", { type: () => String }) campaignId: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<EligibleOrganizationsResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.reassignmentService.getEligibleOrganizations(
            campaignId,
            userContext,
        )
    }

    @Query(() => [CampaignReassignment], {
        description:
            "Get pending reassignment requests for fundraiser's organization",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getPendingReassignmentRequests(
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignReassignment[]> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.reassignmentService.getPendingReassignmentsForFundraiser(
            userContext,
        )
    }
}
