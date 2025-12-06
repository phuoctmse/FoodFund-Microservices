import { Field, ID, ObjectType } from "@nestjs/graphql"
import { DeliveryTaskStatus } from "../enums"
import { User } from "../../shared"
import { DeliveryTask } from "./delivery-task.model"

@ObjectType("DeliveryStatusLog")
export class DeliveryStatusLog {
    @Field(() => ID)
        id: string

    @Field(() => String, { description: "Delivery task ID" })
        deliveryTaskId: string

    @Field(() => DeliveryTaskStatus, { description: "Status at this point" })
        status: DeliveryTaskStatus

    @Field(() => String, { description: "User ID who changed the status" })
        changedBy: string

    @Field(() => String, {
        nullable: true,
        description: "Note when changing status (especially for FAILED/REJECTED)",
    })
        note?: string

    @Field(() => Date, { description: "When this status change occurred" })
        createdAt: Date

    @Field(() => User, { nullable: true })
        user?: User

    @Field(() => DeliveryTask, { nullable: true })
        deliveryTask?: DeliveryTask
}