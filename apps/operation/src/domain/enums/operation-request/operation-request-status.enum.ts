import { registerEnumType } from "@nestjs/graphql"

export enum OperationRequestStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    DISBURSED = "DISBURSED"
}

registerEnumType(OperationRequestStatus, {
    name: "OperationRequestStatus",
    description: "Status of an operation request",
})