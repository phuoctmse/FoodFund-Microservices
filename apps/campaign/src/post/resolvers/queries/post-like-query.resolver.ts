import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { PostLike } from "../../models"
import { PostLikeService } from "../../services"

@Resolver(() => PostLike)
export class PostLikeQueryResolver {
    constructor(private readonly postLikeService: PostLikeService) {}

    @Query(() => [PostLike])
    async postLikes(
        @Args("postId")
            postId: string,
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
    ): Promise<PostLike[]> {
        return await this.postLikeService.getPostLikes(postId, limit, offset)
    }
}
