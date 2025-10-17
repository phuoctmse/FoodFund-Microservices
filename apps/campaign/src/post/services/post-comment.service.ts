import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { CreateCommentInput, UpdateCommentInput } from "../dtos/request"
import { PostCommentRepository, PostRepository } from "../repositories"

@Injectable()
export class PostCommentService {
    private readonly MAX_COMMENT_DEPTH = 3

    constructor(
        private readonly postCommentRepository: PostCommentRepository,
        private readonly postRepository: PostRepository,
    ) {}

    async createComment(data: CreateCommentInput, userId: string) {
        const post = await this.postRepository.findPostById(data.postId)
        if (!post) {
            throw new NotFoundException(
                `Post with ID ${data.postId} does not exists`,
            )
        }

        if (data.parentCommentId) {
            const parentComment =
                await this.postCommentRepository.findCommentById(
                    data.parentCommentId,
                )

            if (!parentComment) {
                throw new NotFoundException(
                    `Parent comment with ID ${data.parentCommentId} does not exist`,
                )
            }

            if (parentComment.depth >= this.MAX_COMMENT_DEPTH) {
                throw new BadRequestException("Cannot reply this comment.")
            }

            if (parentComment.postId !== data.postId) {
                throw new BadRequestException("Parent comment not of this post")
            }
        }

        const comment = await this.postCommentRepository.createComment(
            data,
            userId,
        )
        return comment
    }

    async updateComment(
        commentId: string,
        data: UpdateCommentInput,
        userId: string,
    ) {
        const comment =
            await this.postCommentRepository.findCommentById(commentId)

        if (!comment) {
            throw new NotFoundException(
                `Comment with ID ${commentId} does not exists`,
            )
        }

        if (comment.userId !== userId) {
            throw new ForbiddenException("You can only edit your own comment.")
        }

        return await this.postCommentRepository.updateComment(commentId, data)
    }

    async deleteComment(commentId: string, userId: string) {
        const comment =
            await this.postCommentRepository.findCommentById(commentId)

        if (!comment) {
            throw new NotFoundException(
                `Comment with ID ${commentId} does not exist`,
            )
        }

        if (comment.userId !== userId) {
            throw new ForbiddenException("You can only delete your own comment")
        }

        await this.postCommentRepository.deleteComment(
            commentId,
            comment.postId,
        )

        return {
            success: true,
            message: "Delete successfully",
        }
    }

    async getCommentsByPostId(
        postId: string,
        parentCommentId?: string,
        limit: number = 20,
        offset: number = 0,
    ) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ${postId} not found`)
        }

        return await this.postCommentRepository.findCommentsByPostId(
            postId,
            parentCommentId,
            limit,
            offset,
        )
    }

    async getCommentById(commentId: string) {
        const comment =
            await this.postCommentRepository.findCommentById(commentId)

        if (!comment) {
            throw new NotFoundException(
                `Comment with ID ${commentId} not found`,
            )
        }

        return comment
    }
}
