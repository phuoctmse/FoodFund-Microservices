import { registerEnumType } from "@nestjs/graphql"

export enum OperationRequestSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    STATUS_PENDING_FIRST = "STATUS_PENDING_FIRST",
    STATUS_APPROVED_FIRST = "STATUS_APPROVED_FIRST",
}

registerEnumType(OperationRequestSortOrder, {
    name: "OperationRequestSortOrder",
    description: "Sort order for operation requests",
    valuesMap: {
        NEWEST_FIRST: {
            description: "Sort by creation date (newest first, descending)",
        },
        OLDEST_FIRST: {
            description: "Sort by creation date (oldest first, ascending)",
        },
        STATUS_PENDING_FIRST: {
            description:
                "Sort by status (PENDING → APPROVED/DISBURSED → REJECTED), " +
                "then by creation date (PENDING: oldest first for fair queue, others: newest first)",
        },
        STATUS_APPROVED_FIRST: {
            description:
                "Sort by status (APPROVED → PENDING → DISBURSED → REJECTED), " +
                "then by creation date (APPROVED: oldest first for fair processing, others: newest first)",
        },
    },
})