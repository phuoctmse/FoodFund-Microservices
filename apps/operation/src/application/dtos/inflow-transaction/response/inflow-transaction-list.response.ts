import { InflowTransaction } from "@app/operation/src/domain"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class InflowTransactionListResponse {
    @Field(() => [InflowTransaction], { description: "List of disbursements" })
        items: InflowTransaction[]

    @Field(() => Int, { description: "Total number of items matching filters" })
        total: number

    @Field(() => Int, { description: "Current page number (1-indexed)" })
        page: number

    @Field(() => Int, { description: "Number of items per page" })
        limit: number

    @Field(() => Boolean, { description: "Whether there are more pages" })
        hasMore: boolean
}
