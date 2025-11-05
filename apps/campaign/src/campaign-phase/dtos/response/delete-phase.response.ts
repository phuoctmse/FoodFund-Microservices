import { ObjectType, Field, Int } from "@nestjs/graphql"

@ObjectType()
export class DeletePhasesResponse {
    @Field(() => Boolean, {
        description: "Whether the operation was successful",
    })
        success: boolean

    @Field(() => Int, { description: "Number of phases deleted" })
        deletedCount: number

    @Field(() => [String], {
        description: "IDs of campaigns affected by the deletion",
    })
        affectedCampaignIds: string[]
}
