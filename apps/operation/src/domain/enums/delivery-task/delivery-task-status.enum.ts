import { registerEnumType } from "@nestjs/graphql"

export enum DeliveryTaskStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

registerEnumType(DeliveryTaskStatus, {
    name: "DeliveryTaskStatus",
    description: "Status of a delivery task",
})