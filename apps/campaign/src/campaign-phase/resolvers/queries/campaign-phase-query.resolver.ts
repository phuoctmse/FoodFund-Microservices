import { Args, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { CampaignPhase } from "../../models"
import { CampaignPhaseService } from "../../services"

@Resolver(() => CampaignPhase)
export class CampaignPhaseQueryResolver {
    constructor(private readonly campaignPhaseService: CampaignPhaseService) {}

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
        return this.campaignPhaseService.getPhaseById(reference.id)
    }
}
