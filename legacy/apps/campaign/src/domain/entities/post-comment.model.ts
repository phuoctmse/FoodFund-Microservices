import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { BaseSchema, User } from "../../shared"
import { Post } from "./post.model"

@ObjectType("PostComment")
@Directive("@key(fields: \"id\")")
export class PostComment extends BaseSchema {
    @Field(() => String, {
        description: "ID of the post",
    })
        postId: string

    @Field(() => String, {
        description: "ID of user who commented",
    })
        userId: string

    @Field(() => String, {
        description: "Comment content",
    })
        content: string

    @Field(() => String, {
        nullable: true,
        description: "Parent comment ID for nested replies",
    })
        parentCommentId?: string

    @Field(() => String, {
        nullable: true,
        description: "Materialized path for nested comments (e.g., '1/2/3')",
    })
        commentPath?: string

    @Field(() => Int, {
        description: "Nesting depth level (0 = top-level)",
        defaultValue: 0,
    })
        depth: number

    @Field(() => Boolean, {
        description: "Whether comment is active (soft delete)",
        defaultValue: true,
    })
        isActive: boolean

    @Field(() => Post, {
        nullable: true,
        description: "The post this comment belongs to",
    })
        post?: Post

    @Field(() => User, {
        nullable: true,
        description: "User who commented - resolved via federation",
    })
        user?: User

    @Field(() => PostComment, {
        nullable: true,
        description: "Parent comment if this is a reply",
    })
        parentComment?: PostComment

    @Field(() => [PostComment], {
        nullable: true,
        description: "Child replies to this comment",
        defaultValue: [],
    })
        replies?: PostComment[]

    constructor() {
        super()
    }
}
