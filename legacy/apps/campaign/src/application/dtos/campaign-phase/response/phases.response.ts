import { CampaignPhase } from "@app/campaign/src/domain/entities/campaign-phase.model"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class SyncPhasesResponse {
    @Field(() => Boolean, {
        description: "Whether the sync operation was successful",
    })
        success: boolean

    @Field(() => [CampaignPhase], {
        description: "All phases after sync (created + updated)",
    })
        phases: CampaignPhase[]

    @Field(() => Int, { description: "Number of phases created" })
        createdCount: number

    @Field(() => Int, { description: "Number of phases updated" })
        updatedCount: number

    @Field(() => Int, { description: "Number of phases deleted" })
        deletedCount: number

    @Field(() => String, {
        description: "Summary message of the operation",
    })
        message: string
}