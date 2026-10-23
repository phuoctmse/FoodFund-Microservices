import { PostCommentService } from "@app/campaign/src/application/services/post/post-comment.service"
import { PostComment } from "@app/campaign/src/domain/entities/post-comment.model"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => PostComment)
export class PostCommentQueryResolver {
    constructor(private readonly postCommentService: PostCommentService) {}

    @Query(() => [PostComment], {
        description: "Get all comments",
    })
    async postCommentsTree(
        @Args("postId", {
            description: "Post ID to fetch comments for",
        })
            postId: string,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 20,
            description: "Maximum number of top-level comments to return",
        })
            limit: number = 20,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of top-level comments to skip for pagination",
        })
            offset: number = 0,
    ): Promise<PostComment[]> {
        return await this.postCommentService.getCommentsByPostId(
            postId,
            limit,
            offset,
        )
    }
}
