import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { CampaignPhaseService } from "@app/campaign/src/application/services/campaign-phase/campaign-phase.service"
import {
    SyncPhaseInput,
    UpdatePhaseStatusInput,
} from "@app/campaign/src/application/dtos/campaign-phase/request"
import { SyncPhasesResponse } from "@app/campaign/src/application/dtos/campaign-phase/response"

@Resolver(() => CampaignPhase)
@UseGuards(CognitoGraphQLGuard)
export class CampaignPhaseMutationResolver {
    constructor(private readonly campaignPhaseService: CampaignPhaseService) {}

    @Mutation(() => SyncPhasesResponse, {
        description:
            "Sync all phases for a campaign atomically. " +
            "Creates new phases (without id), updates existing (with id), " +
            "and deletes phases not in the array. " +
            "Total budget must equal 100%.",
    })
    async syncCampaignPhases(
        @Args("campaignId", {
            type: () => String,
            description: "Campaign ID to sync phases for",
        })
            campaignId: string,
        @Args("phases", {
            type: () => [SyncPhaseInput],
            description:
                "Array of phases to sync. Include 'id' to update existing phase, omit to create new",
        })
            phases: SyncPhaseInput[],
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<SyncPhasesResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignPhaseService.syncCampaignPhases(
            campaignId,
            phases,
            userContext,
        )
    }

    @Mutation(() => CampaignPhase, {
        description:
            "Update campaign phase status (COMPLETED, CANCELLED, FAILED). Fundraiser only. Auto-marks campaign COMPLETED when all phases done.",
    })
    async updatePhaseStatus(
        @Args(
            "input",
            { type: () => UpdatePhaseStatusInput },
            new ValidationPipe(),
        )
            input: UpdatePhaseStatusInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignPhase> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignPhaseService.updatePhaseStatus(input, userContext)
    }
}
