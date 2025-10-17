import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { PostComment } from "../../models"
import { PostCommentService } from "../../services"

@Resolver(() => PostComment)
export class PostCommentQueryResolver {
    constructor(private readonly postCommentService: PostCommentService) {}

    @Query(() => [PostComment])
    async postComments(
        @Args("postId")
            postId: string,
        @Args("parentCommentId", {
            nullable: true,
        })
            parentCommentId?: string,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 20,
        })
            limit: number = 20,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
        })
            offset: number = 0,
    ): Promise<PostComment[]> {
        return await this.postCommentService.getCommentsByPostId(
            postId,
            parentCommentId,
            limit,
            offset,
        )
    }

    @Query(() => PostComment, {
        nullable: true,
    })
    async comment(
        @Args("commentId") commentId: string,
    ): Promise<PostComment | null> {
        return await this.postCommentService.getCommentById(commentId)
    }
}
