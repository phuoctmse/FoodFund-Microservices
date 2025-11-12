import { registerEnumType } from "@nestjs/graphql"

export enum IngredientRequestSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
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
    },
})