import { registerEnumType } from "@nestjs/graphql"

export enum IngredientRequestSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    STATUS_PENDING_FIRST = "STATUS_PENDING_FIRST",
    STATUS_APPROVED_FIRST = "STATUS_APPROVED_FIRST",
}

registerEnumType(IngredientRequestSortOrder, {
    name: "IngredientRequestSortOrder",
    description: "Sort order options for ingredient requests",
    valuesMap: {
        NEWEST_FIRST: {
            description: "Sort by creation date (newest first)",
        },
        OLDEST_FIRST: {
            description: "Sort by creation date (oldest first)",
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