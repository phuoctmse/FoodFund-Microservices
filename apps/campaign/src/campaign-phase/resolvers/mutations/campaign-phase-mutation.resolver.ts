import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CampaignPhase } from "../../models"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "../../../shared"
import { CampaignPhaseService } from "../../services"
import {
    CreatePhaseInput,
    DeletePhasesResponse,
    UpdatePhaseInput,
} from "../../dtos"

@Resolver(() => CampaignPhase)
@UseGuards(CognitoGraphQLGuard)
export class CampaignPhaseMutationResolver {
    constructor(private readonly campaignPhaseService: CampaignPhaseService) {}

    @Mutation(() => CampaignPhase, {
        description: "Add a new phase to an existing campaign",
    })
    async addCampaignPhase(
        @Args("campaignId", { type: () => String, description: "Campaign ID" })
            campaignId: string,
        @Args("input", { type: () => CreatePhaseInput }, new ValidationPipe())
            input: CreatePhaseInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignPhase> {
        const userContext = createUserContextFromToken(decodedToken)
        const phase = await this.campaignPhaseService.createPhase(
            campaignId,
            input,
            userContext,
        )

        return phase
    }

    @Mutation(() => CampaignPhase, {
        description: "Update an existing campaign phase",
    })
    async updateCampaignPhase(
        @Args("id", { type: () => String, description: "Phase ID" }) id: string,
        @Args("input", { type: () => UpdatePhaseInput }, new ValidationPipe())
            input: UpdatePhaseInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<CampaignPhase> {
        const userContext = createUserContextFromToken(decodedToken)
        const updatedPhase = await this.campaignPhaseService.updatePhase(
            id,
            input,
            userContext,
        )

        return updatedPhase
    }

    @Mutation(() => Boolean, {
        description: "Delete a campaign phase",
    })
    async deleteCampaignPhase(
        @Args("id", {
            type: () => String,
            description: "Phase ID to delete",
        })
            id: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<boolean> {
        const userContext = createUserContextFromToken(decodedToken)
        return this.campaignPhaseService.deletePhase(id, userContext)
    }

    @Mutation(() => DeletePhasesResponse, {
        description: "Delete multiple campaign phases",
    })
    async deleteManyCampaignPhases(
        @Args("ids", {
            type: () => [String],
            description: "Array of phase IDs to delete",
        })
            ids: string[],
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<DeletePhasesResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const result = await this.campaignPhaseService.deleteManyPhases(
            ids,
            userContext,
        )

        return {
            success: true,
            deletedCount: result.deletedCount,
            affectedCampaignIds: result.campaignIds,
        }
    }
}
