import { registerEnumType } from "@nestjs/graphql"

export enum InflowTransactionStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

registerEnumType(InflowTransactionStatus, {
    name: "InflowTransactionStatus",
    description: "Status of inflow transaction (disbursement)",
    valuesMap: {
        PENDING: {
            description: "Admin has created the disbursement, waiting for fundraiser confirmation",
        },
        COMPLETED: {
            description: "Fundraiser has confirmed receiving the money",
        },
        FAILED: {
            description: "Fundraiser has not received the money or encountered issues",
        },
    },
})
