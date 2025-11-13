import {
    Args,
    Parent,
    Query,
    ResolveField,
    Resolver,
    ResolveReference,
} from "@nestjs/graphql"
import { forwardRef, Inject } from "@nestjs/common"
import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import { CampaignPhaseService } from "@app/campaign/src/application/services/campaign-phase/campaign-phase.service"
import { CampaignService } from "@app/campaign/src/application/services/campaign/campaign.service"

@Resolver(() => CampaignPhase)
export class CampaignPhaseQueryResolver {
    constructor(
        private readonly campaignPhaseService: CampaignPhaseService,
        @Inject(forwardRef(() => CampaignService))
        private readonly campaignService: CampaignService,
    ) {}

    @Query(() => [CampaignPhase], {
        description: "Get all phases for a campaign",
    })
    async campaignPhases(
        @Args("campaignId", { type: () => String, description: "Campaign ID" })
            campaignId: string,
    ): Promise<CampaignPhase[]> {
        return this.campaignPhaseService.getPhasesByCampaignId(campaignId)
    }

    @Query(() => CampaignPhase, {
        description: "Get a single phase by ID",
        nullable: true,
    })
    async campaignPhase(
        @Args("id", { type: () => String, description: "Phase ID" })
            id: string,
    ): Promise<CampaignPhase | null> {
        return this.campaignPhaseService.getPhaseById(id)
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<CampaignPhase | null> {
        const phase = await this.campaignPhaseService.getPhaseById(reference.id)
        if (!phase) {
            return null
        }

        if (phase.campaignId) {
            try {
                const campaign = await this.campaignService.findCampaignById(
                    phase.campaignId,
                )
                phase.campaign = campaign
            } catch (error) {
                phase.campaign = undefined
            }
        }

        return phase
    }
}
