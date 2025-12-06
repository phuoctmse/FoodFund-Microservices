import { ObjectType, Field, Int, Float } from "@nestjs/graphql"

@ObjectType()
export class DeliveryTaskStatsResponse {
    @Field(() => Int, { description: "Total number of delivery tasks" })
        totalTasks: number

    @Field(() => Int, { description: "Number of pending tasks" })
        pendingCount: number

    @Field(() => Int, { description: "Number of accepted tasks" })
        acceptedCount: number

    @Field(() => Int, { description: "Number of rejected tasks" })
        rejectedCount: number

    @Field(() => Int, { description: "Number of out for delivery tasks" })
        outForDeliveryCount: number

    @Field(() => Int, { description: "Number of completed tasks" })
        completedCount: number

    @Field(() => Int, { description: "Number of failed tasks" })
        failedCount: number

    @Field(() => Float, {
        description: "Completion rate percentage (completed / total completed + failed)",
    })
        completionRate: number

    @Field(() => Float, {
        description: "Failure rate percentage (failed / total completed + failed)",
    })
        failureRate: number
}