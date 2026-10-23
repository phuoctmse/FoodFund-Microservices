import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PostLikeResponse {
    @Field(() => Boolean, {
        description: "Operation success status",
    })
        success: boolean

    @Field(() => String, {
        description: "Response message",
    })
        message: string

    @Field(() => Boolean, {
        description: "Whether post is now liked by user",
    })
        isLiked: boolean

    @Field(() => Number, {
        description: "Updated like count",
    })
        likeCount: number

    @Field(() => Boolean, {
        nullable: true,
        description: "Whether this is an optimistic update (true) or confirmed from DB (false)",
        defaultValue: false,
    })
        isOptimistic?: boolean
}