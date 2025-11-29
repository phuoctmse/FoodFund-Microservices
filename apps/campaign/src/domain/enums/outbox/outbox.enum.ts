import { registerEnumType } from "@nestjs/graphql"

export enum OutboxStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

registerEnumType(OutboxStatus, {
    name: "OutboxStatus",
    description: "Status of outbox event",
    valuesMap: {
        PENDING: { description: "Waiting for processing" },
        PROCESSING: { description: "Processing" },
        COMPLETED: { description: "Completed" },
        FAILED: { description: "Failed" },
    },
})