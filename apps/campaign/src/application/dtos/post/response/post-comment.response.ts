import { PostComment } from "@app/campaign/src/domain/entities/post-comment.model"
import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PostCommentResponse {
    @Field(() => Boolean, {
        description: "Operation success status",
    })
        success: boolean

    @Field(() => String, {
        description: "Response message",
    })
        message: string

    @Field(() => PostComment, {
        nullable: true,
        description: "The created/updated comment",
    })
        comment?: PostComment
}
