import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
export class SyncResult {
    @Field(() => Int)
    successCount: number

    @Field(() => Int)
    failCount: number
}
