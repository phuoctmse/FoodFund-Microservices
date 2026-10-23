import { Args, Mutation, Resolver } from "@nestjs/graphql"
import {
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { SpacesUploadService } from "@libs/s3-storage/spaces-upload.service"
import { PostService } from "@app/campaign/src/application/services/post/post.service"
import { PostLikeDataLoader } from "@app/campaign/src/application/dataloaders"
import { PostMediaUploadResponse, PostResponse } from "@app/campaign/src/application/dtos/post/response"
import { CreatePostInput, GeneratePostMediaUploadUrlsInput, UpdatePostInput } from "@app/campaign/src/application/dtos/post/request"

@Resolver()
@UseGuards(CognitoGraphQLGuard)
export class PostMutationResolver {
    private readonly resource = "posts"

    constructor(
        private readonly postService: PostService,
        private readonly spacesUploadService: SpacesUploadService,
        private readonly postLikeDataLoader: PostLikeDataLoader,
    ) {}

    @Mutation(() => PostMediaUploadResponse, {
        description:
            "Generate presigned upload URLs for multiple post media files (images/videos)",
    })
    async generatePostMediaUploadUrls(
        @Args("input") input: GeneratePostMediaUploadUrlsInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostMediaUploadResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        const uploadUrls =
            await this.spacesUploadService.generateBatchImageUploadUrls(
                userContext.userId,
                this.resource,
                input.fileCount,
                input.fileTypes,
                input.postId,
            )

        return {
            success: true,
            message: `Generated ${input.fileCount} upload URLs successfully`,
            uploadUrls
        }
    }

    @Mutation(() => PostResponse)
    async createPost(
        @Args("input") input: CreatePostInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const post = await this.postService.createPost(
            input,
            userContext.userId,
        )
        const isLikedByMe = false
        return {
            success: true,
            message: "Đã tạo bài viết thành công",
            post: {
                ...post,
                isLikedByMe,
            },
        }
    }

    @Mutation(() => PostResponse)
    async updatePost(
        @Args("id") id: string,
        @Args("input") input: UpdatePostInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const post = await this.postService.updatePost(
            id,
            input,
            userContext.userId,
        )
        const isLikedByMe = await this.postLikeDataLoader.load({
            postId: post.id,
            userId: userContext.userId,
        })

        return {
            success: true,
            message: "Đã cập nhật bài viết thành công",
            post: {
                ...post,
                isLikedByMe,
            },
        }
    }

    @Mutation(() => PostResponse)
    async deletePost(
        @Args("id") id: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        const result = await this.postService.deletePost(id, userContext.userId)
        return {
            success: result.success,
            message: result.message,
            post: undefined,
        }
    }
}
