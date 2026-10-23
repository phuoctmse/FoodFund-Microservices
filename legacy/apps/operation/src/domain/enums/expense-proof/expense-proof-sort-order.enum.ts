import { registerEnumType } from "@nestjs/graphql"

export enum ExpenseProofSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    STATUS_PENDING_FIRST = "STATUS_PENDING_FIRST",
}

registerEnumType(ExpenseProofSortOrder, {
    name: "ExpenseProofSortOrder",
    description: "Sort order options for expense proofs",
    valuesMap: {
        NEWEST_FIRST: {
            description: "Sort by creation date (newest first, descending)",
        },
        OLDEST_FIRST: {
            description: "Sort by creation date (oldest first, ascending)",
        },
        STATUS_PENDING_FIRST: {
            description: "Sort by status (PENDING → APPROVED → REJECTED), then by creation date (newest first)",
        },
    },
})