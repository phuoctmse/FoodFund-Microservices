import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, User } from "../../shared"
import { Post } from "./post.model"

@ObjectType("PostLike")
@Directive("@key(fields: \"id\")")
export class PostLike extends BaseSchema {
    @Field(() => String)
        postId: string

    @Field(() => String)
        userId: string

    @Field(() => Post, {
        nullable: true,
    })
        post?: Post

    @Field(() => User, {
        nullable: true,
    })
        user?: User

    constructor() {
        super()
    }
}
