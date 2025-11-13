import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { BaseSchema, User } from "../../shared"
import { PostLike } from "./post-like.model"
import { PostComment } from "./post-comment.model"
import { Campaign } from "./campaign.model"

@ObjectType("Post")
@Directive("@key(fields: \"id\")")
export class Post extends BaseSchema {
    @Field(() => String, {
        description: "ID of campaign this post belongs to",
    })
        campaignId: string

    @Field(() => String, {
        description: "ID of user who created this post",
    })
        createdBy: string

    @Field(() => String, {
        description: "Post title",
    })
        title: string

    @Field(() => String, {
        description: "Post content/body",
    })
        content: string

    @Field(() => String, {
        nullable: true,
        description: "Media attachments (JSON array of URLs)",
    })
        media?: string

    @Field(() => Int, {
        description: "Number of likes",
        defaultValue: 0,
    })
        likeCount: number

    @Field(() => Int, {
        description: "Number of comments",
        defaultValue: 0,
    })
        commentCount: number

    @Field(() => Boolean, {
        description: "Whether post is active/visible",
        defaultValue: true,
    })
        isActive: boolean

    @Field(() => Campaign, {
        nullable: true,
        description: "Campaign this post belongs to",
    })
        campaign?: Campaign

    @Field(() => User, {
        nullable: true,
        description: "User who created this post - resolved via federation",
    })
        creator?: User

    @Field(() => [PostLike], {
        nullable: true,
        description: "List of likes on this post",
        defaultValue: [],
    })
        likes?: PostLike[]

    @Field(() => [PostComment], {
        nullable: true,
        description: "List of comments on this post",
        defaultValue: [],
    })
        comments?: PostComment[]

    @Field(() => Boolean, { nullable: true })
        isLikedByMe?: boolean

    constructor() {
        super()
    }
}
