import { Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, User } from "../../shared"
import { DeliveryTaskStatus } from "../enums"
import { MealBatch } from "./meal-batch.model"
import { DeliveryStatusLog } from "./delivery-status-log.model"

@ObjectType("DeliveryTask")
export class DeliveryTask extends BaseSchema {
    @Field(() => String, { description: "Delivery staff ID" })
        deliveryStaffId: string

    @Field(() => String, { description: "Meal batch ID" })
        mealBatchId: string

    @Field(() => DeliveryTaskStatus, {
        description: "Task status",
        defaultValue: DeliveryTaskStatus.PENDING,
    })
        status: DeliveryTaskStatus

    @Field(() => User, { nullable: true })
        deliveryStaff?: User

    @Field(() => MealBatch, { nullable: true })
        mealBatch?: MealBatch

    @Field(() => [DeliveryStatusLog], { nullable: true })
        statusLogs?: DeliveryStatusLog[]
}