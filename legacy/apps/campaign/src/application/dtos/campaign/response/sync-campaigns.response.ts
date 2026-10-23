import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class SyncCampaignsResponse {
    @Field(() => Int)
        successCount: number

    @Field(() => Int)
        failCount: number
}
