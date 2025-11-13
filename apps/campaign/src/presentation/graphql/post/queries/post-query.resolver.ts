import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { CurrentUser } from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@app/campaign/src/shared/guards"
import { Post } from "@app/campaign/src/domain/entities/post.model"
import { PostService } from "@app/campaign/src/application/services/post/post.service"
import { PostLikeDataLoader } from "@app/campaign/src/application/dataloaders"
import { PostSortOrder } from "@app/campaign/src/domain/enums/post/post.enum"

@Resolver(() => Post)
export class PostQueryResolver {
    constructor(
        private readonly postService: PostService,
        private readonly postLikeDataLoader: PostLikeDataLoader,
    ) {}

    @Query(() => [Post], {
        description: "Get posts by campaign ID",
    })
    @UseGuards(CognitoGraphQLGuard)
    async postsByCampaign(
        @Args("campaignId", {
            description: "Campaign ID to fetch posts for",
        })
            campaignId: string,
        @Args("sortBy", {
            type: () => PostSortOrder,
            nullable: true,
            defaultValue: PostSortOrder.NEWEST_FIRST,
            description: "Sort order for posts",
        })
            sortBy: PostSortOrder = PostSortOrder.NEWEST_FIRST,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 10,
            description: "Number of posts to return (max 100)",
        })
            limit: number = 10,
        @Args("offset", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of posts to skip for pagination",
        })
            offset: number = 0,
        @CurrentUser("decodedToken") decodedToken?: any,
    ): Promise<Post[]> {
        const userId = decodedToken?.sub || null

        return this.postService.getPostsByCampaignId(
            campaignId,
            userId,
            this.postLikeDataLoader,
            sortBy,
            Math.min(limit, 100),
            Math.max(offset, 0),
        )
    }

    @Query(() => Post, {
        description: "Get a single post by ID",
        nullable: true,
    })
    @UseGuards(CognitoGraphQLGuard)
    async post(
        @Args("id", {
            description: "Post ID",
        })
            id: string,
        @CurrentUser("decodedToken") decodedToken?: any,
    ): Promise<Post | null> {
        const userId = decodedToken?.sub || null

        return this.postService.getPostById(id, userId, this.postLikeDataLoader)
    }
}
