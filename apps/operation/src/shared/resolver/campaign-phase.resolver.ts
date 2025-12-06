import { Resolver, ResolveReference } from "@nestjs/graphql"
import { CampaignPhase } from "../model"

@Resolver(() => CampaignPhase)
export class CampaignPhaseResolver {
    @ResolveReference()
    resolveReference(reference: {
        __typename: string
        id: string
    }): CampaignPhase {
        return {
            __typename: "CampaignPhase",
            id: reference.id,
        } as CampaignPhase
    }
}
