import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { PostCommentService } from "../../services"
import { PostCommentResponse } from "../../dtos/response"
import { CreateCommentInput, UpdateCommentInput } from "../../dtos/request"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import {
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"

@Resolver()
@UseGuards(CognitoGraphQLGuard)
export class PostCommentMutationResolver {
    constructor(private readonly postCommentService: PostCommentService) {}

    @Mutation(() => PostCommentResponse)
    async createComment(
        @Args("input") input: CreateCommentInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostCommentResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        const comment = await this.postCommentService.createComment(
            input,
            userContext.userId,
        )

        return {
            success: true,
            message: "Đã tạo bình luận thành công",
            comment,
        }
    }

    @Mutation(() => PostCommentResponse)
    async updateComment(
        @Args("commentId") commentId: string,
        @Args("input") input: UpdateCommentInput,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostCommentResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        const comment = await this.postCommentService.updateComment(
            commentId,
            input,
            userContext.userId,
        )

        return {
            success: true,
            message: "Đã cập nhật bình luận thành công",
            comment,
        }
    }

    @Mutation(() => PostCommentResponse)
    async deleteComment(
        @Args("commentId") commentId: string,
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<PostCommentResponse> {
        const userContext = createUserContextFromToken(decodedToken)

        const result = await this.postCommentService.deleteComment(
            commentId,
            userContext.userId,
        )

        return {
            success: result.success,
            message: result.message,
            comment: undefined,
        }
    }
}
