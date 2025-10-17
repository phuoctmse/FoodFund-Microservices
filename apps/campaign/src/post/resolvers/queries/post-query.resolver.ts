import { Args, Query, Resolver } from "@nestjs/graphql"
import { Post } from "../../models"
import { PostService } from "../../services/post.service"
import { PostLikeDataLoader } from "../../dataloaders/post-like.dataloader"
import { CurrentUser } from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@app/campaign/src/shared/guards"

@Resolver(() => Post)
export class PostQueryResolver {
    constructor(
        private readonly postService: PostService,
        private readonly postLikeDataLoader: PostLikeDataLoader,
    ) {}

    @Query(() => Post, {
        description:
            "Get a post by campaign ID (public access, optional authentication)",
        nullable: true,
    })
    @UseGuards(CognitoGraphQLGuard)
    async post(
        @Args("campaignId") campaignId: string,
        @CurrentUser("decodedToken") decodedToken?: any,
    ): Promise<Post | null> {
        const userId = decodedToken?.sub || null
        return this.postService.getPostByCampaignId(
            campaignId,
            userId,
            this.postLikeDataLoader,
        )
    }
}
