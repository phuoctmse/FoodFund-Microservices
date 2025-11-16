import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { PostCommentRepository } from "../../repositories/post-comment.repository"
import { PostRepository } from "../../repositories/post.repository"
import { CreateCommentInput, UpdateCommentInput } from "../../dtos/post/request"
import { PostCacheService } from "./post-cache.service"

@Injectable()
export class PostCommentService {
    private readonly MAX_COMMENT_DEPTH = 3

    constructor(
        private readonly postCommentRepository: PostCommentRepository,
        private readonly postRepository: PostRepository,
        private readonly postCacheService: PostCacheService,
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

        const currentCount = await this.postCacheService.getCommentsCount(
            data.postId,
        )

        if (currentCount === null) {
            await this.postCacheService.initializeCommentsCount(
                data.postId,
                post.commentCount + 1,
            )
        } else {
            await this.postCacheService.incrementCommentsCount(data.postId)
        }

        await Promise.all([
            this.postCacheService.deletePostComments(data.postId),
            this.postCacheService.deletePost(data.postId),
        ])

        return comment
    }

    async getCommentsByPostId(
        postId: string,
        limit: number = 20,
        offset: number = 0,
    ) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ${postId} not found`)
        }

        if (limit === 20 && offset === 0) {
            const cachedComments =
                await this.postCacheService.getPostComments(postId)

            if (cachedComments) {
                return cachedComments
            }
        }

        const comments = await this.postCommentRepository.findCommentsByPostId(
            postId,
            limit,
            offset,
        )

        if (limit === 20 && offset === 0) {
            await this.postCacheService.setPostComments(postId, comments)
        }

        return comments
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

        const updatedComment =
            await this.postCommentRepository.updateComment(commentId, data)

        await this.postCacheService.deletePostComments(comment.postId)

        return updatedComment
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

        const updatedCommentCount =
            await this.postCommentRepository.getCommentCount(comment.postId)

        await Promise.all([
            this.postCacheService.deletePostComments(comment.postId),
            this.postCacheService.initializeCommentsCount(
                comment.postId,
                updatedCommentCount,
            ),
            this.postCacheService.deletePost(comment.postId),
        ])

        return {
            success: true,
            message: "Delete successfully",
        }
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
