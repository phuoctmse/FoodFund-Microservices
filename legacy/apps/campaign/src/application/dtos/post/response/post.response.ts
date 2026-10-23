import { Post } from "@app/campaign/src/domain/entities/post.model"
import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PostResponse {
    @Field(() => Boolean, {
        description: "Operation success status",
    })
        success: boolean

    @Field(() => String, {
        description: "Response message",
    })
        message: string

    @Field(() => Post, {
        nullable: true,
        description: "The created/updated post",
    })
        post?: Post
}
