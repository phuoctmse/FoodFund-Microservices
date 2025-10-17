import { Field, ObjectType } from "@nestjs/graphql"
import { Post } from "../../models"

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
