import { registerEnumType } from "@nestjs/graphql"

export enum OperationRequestSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
}

registerEnumType(OperationRequestSortOrder, {
    name: "OperationRequestSortOrder",
    description: "Sort order for operation requests by creation date",
    valuesMap: {
        NEWEST_FIRST: {
            description: "Sort by creation date (newest first, descending)",
        },
        OLDEST_FIRST: {
            description: "Sort by creation date (oldest first, ascending)",
        },
    },
})