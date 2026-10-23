import { ObjectType, Field, Int } from "@nestjs/graphql"

@ObjectType()
export class OperationRequestStatsResponse {
    @Field(() => Int, { description: "Total number of operation requests" })
        totalRequests: number

    @Field(() => Int, { description: "Number of pending requests" })
        pendingCount: number

    @Field(() => Int, { description: "Number of approved requests" })
        approvedCount: number

    @Field(() => Int, { description: "Number of rejected requests" })
        rejectedCount: number

    @Field(() => Int, { description: "Number of disbursed requests" })
        disbursedCount: number
}