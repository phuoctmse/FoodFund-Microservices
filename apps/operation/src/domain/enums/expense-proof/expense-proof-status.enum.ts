import { registerEnumType } from "@nestjs/graphql"

export enum ExpenseProofStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
}

registerEnumType(ExpenseProofStatus, {
    name: "ExpenseProofStatus",
    description: "Status of expense proof approval",
})
