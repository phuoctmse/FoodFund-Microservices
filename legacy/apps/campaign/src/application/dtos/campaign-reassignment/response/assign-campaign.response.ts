import { CampaignReassignment } from "@app/campaign/src/domain/entities/campaign-reassignment.model"
import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class AssignCampaignResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => [CampaignReassignment])
        assignments: CampaignReassignment[]

    @Field(() => Number)
        assignedCount: number

    @Field(() => Date, { description: "Expiration date for all assignments" })
        expiresAt: Date
}
