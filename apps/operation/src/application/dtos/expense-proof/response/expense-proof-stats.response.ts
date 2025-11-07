import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class ExpenseProofStatsResponse {
    @Field(() => Int)
        totalProofs: number

    @Field(() => Int)
        pendingCount: number

    @Field(() => Int)
        approvedCount: number

    @Field(() => Int)
        rejectedCount: number
}
