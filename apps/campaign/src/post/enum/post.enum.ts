import { registerEnumType } from "@nestjs/graphql"

export enum PostSortOrder {
    NEWEST_FIRST = "NEWEST_FIRST",
    OLDEST_FIRST = "OLDEST_FIRST",
    MOST_LIKED = "MOST_LIKED",
    MOST_COMMENTED = "MOST_COMMENTED",
}

registerEnumType(PostSortOrder, {
    name: "PostSortOrder",
    description: "Sort order for posts",
})
