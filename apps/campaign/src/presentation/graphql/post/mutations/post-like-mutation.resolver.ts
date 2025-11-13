import { Args, Mutation, Resolver } from "@nestjs/graphql"
import {
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { PostLikeService } from "@app/campaign/src/application/services/post/post-like.service"
import { PostLikeResponse } from "@app/campaign/src/application/dtos/post/response"

@Resolver()
@UseGuards(CognitoGraphQLGuard)
export class PostLikeMutationResolver {
    constructor(private readonly postLikeService: PostLikeService) {}

    @Mutation(() => PostLikeResponse)
    async likePost(
        @Args("postId") postId: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostLikeResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        return await this.postLikeService.likePost(postId, userContext.userId)
    }

    @Mutation(() => PostLikeResponse)
    async unlikePost(
        @Args("postId") postId: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostLikeResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.postLikeService.unlikePost(postId, userContext.userId)
    }
}
