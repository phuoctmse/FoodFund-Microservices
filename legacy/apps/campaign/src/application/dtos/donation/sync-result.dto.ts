import { Directive, Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
@Directive("@shareable")
export class SyncResult {
    @Field(() => Int)
        successCount: number

    @Field(() => Int)
        failCount: number
}
