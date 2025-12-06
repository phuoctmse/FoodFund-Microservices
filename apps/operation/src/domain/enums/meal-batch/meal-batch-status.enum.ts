import { registerEnumType } from "@nestjs/graphql"

export enum MealBatchStatus {
    PREPARING = "PREPARING",
    READY = "READY",
    DELIVERED = "DELIVERED",
}

registerEnumType(MealBatchStatus, {
    name: "MealBatchStatus",
    description: "Status of meal batch (PREPARING, READY, DELIVERED)",
})
