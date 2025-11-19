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
import { EventEmitter2 } from "@nestjs/event-emitter"
import {
    PostCommentEvent,
    PostReplyEvent,
} from "@app/campaign/src/domain/events"
import { PostComment } from "@app/campaign/src/domain/entities/post-comment.model"
import { UserClientService } from "@app/campaign/src/shared"
import { stripHtmlTags } from "@app/campaign/src/shared/utils"

@Injectable()
export class PostCommentService {
    private readonly MAX_COMMENT_DEPTH = 3

    constructor(
        private readonly postCommentRepository: PostCommentRepository,
        private readonly postRepository: PostRepository,
        private readonly postCacheService: PostCacheService,
        private readonly eventEmitter: EventEmitter2,
        private readonly userClient: UserClientService,
    ) {}

    async createComment(
        data: CreateCommentInput,
        userId: string,
    ): Promise<PostComment> {
        const post = await this.postRepository.findPostById(data.postId)
        if (!post) {
            throw new NotFoundException(
                `Post with ID ${data.postId} does not exist`,
            )
        }

        const parentComment = await this.validateParentComment(data, post.id)

        const comment = await this.postCommentRepository.createComment(
            data,
            userId,
        )

        await this.updateCommentCountCache(data.postId, post.commentCount)
        await this.invalidatePostCaches(data.postId)
        await this.emitCommentNotificationEvent(
            comment,
            post,
            userId,
            parentComment,
            data,
        )

        return comment
    }

    async getCommentsByPostId(
        postId: string,
        limit: number = 20,
        offset: number = 0,
    ): Promise<PostComment[]> {
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
    ): Promise<PostComment> {
        const comment =
            await this.postCommentRepository.findCommentById(commentId)

        if (!comment) {
            throw new NotFoundException(
                `Comment with ID ${commentId} does not exist`,
            )
        }

        if (comment.userId !== userId) {
            throw new ForbiddenException("You can only edit your own comment")
        }

        const updatedComment = await this.postCommentRepository.updateComment(
            commentId,
            data,
        )

        await this.postCacheService.deletePostComments(comment.postId)

        return updatedComment
    }

    async deleteComment(
        commentId: string,
        userId: string,
    ): Promise<{ success: boolean; message: string }> {
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
            message: "Comment deleted successfully",
        }
    }

    async getCommentById(commentId: string): Promise<PostComment> {
        const comment =
            await this.postCommentRepository.findCommentById(commentId)

        if (!comment) {
            throw new NotFoundException(
                `Comment with ID ${commentId} not found`,
            )
        }

        return comment
    }

    private async validateParentComment(
        data: CreateCommentInput,
        postId: string,
    ): Promise<PostComment | null> {
        if (!data.parentCommentId) {
            return null
        }

        const parentComment = await this.postCommentRepository.findCommentById(
            data.parentCommentId,
        )

        if (!parentComment) {
            throw new NotFoundException(
                `Parent comment with ID ${data.parentCommentId} does not exist`,
            )
        }

        if (parentComment.depth >= this.MAX_COMMENT_DEPTH) {
            throw new BadRequestException(
                `Cannot reply to comment. Maximum depth of ${this.MAX_COMMENT_DEPTH} reached`,
            )
        }

        if (parentComment.postId !== postId) {
            throw new BadRequestException(
                "Parent comment does not belong to this post",
            )
        }

        return parentComment
    }

    private async updateCommentCountCache(
        postId: string,
        currentCount: number,
    ): Promise<void> {
        const cachedCount = await this.postCacheService.getCommentsCount(postId)

        if (cachedCount === null) {
            await this.postCacheService.initializeCommentsCount(
                postId,
                currentCount + 1,
            )
        } else {
            await this.postCacheService.incrementCommentsCount(postId)
        }
    }

    private async invalidatePostCaches(postId: string): Promise<void> {
        await Promise.all([
            this.postCacheService.deletePostComments(postId),
            this.postCacheService.deletePost(postId),
        ])
    }

    private async emitCommentNotificationEvent(
        comment: PostComment,
        post: any,
        userId: string,
        parentComment: PostComment | null,
        data: CreateCommentInput,
    ): Promise<void> {
        const commentPreview = this.createCommentPreview(data.content)

        if (parentComment && data.parentCommentId) {
            this.emitReplyNotification(
                comment,
                post,
                userId,
                parentComment,
                commentPreview,
                data.parentCommentId,
            )
        } else {
            this.emitCommentNotification(comment, post, userId, commentPreview)
        }
    }

    private async emitReplyNotification(
        comment: PostComment,
        post: any,
        userId: string,
        parentComment: PostComment,
        commentPreview: string,
        parentCommentId: string,
    ): Promise<void> {
        if (parentComment.userId === userId) {
            return
        }

        const replierName = await this.userClient.getUserDisplayName(userId)

        this.eventEmitter.emit("comment.replied", {
            replyId: comment.id,
            postId: post.id,
            postTitle: post.title,
            parentCommentId,
            parentCommentAuthorId: parentComment.userId,
            replierId: userId,
            replierName,
            replyPreview: commentPreview,
        } satisfies PostReplyEvent)
    }

    private async emitCommentNotification(
        comment: PostComment,
        post: any,
        userId: string,
        commentPreview: string,
    ): Promise<void> {
        if (post.createdBy === userId) {
            return
        }

        const commenterName = await this.userClient.getUserDisplayName(userId)

        this.eventEmitter.emit("post.commented", {
            commentId: comment.id,
            postId: post.id,
            postTitle: post.title,
            postAuthorId: post.createdBy,
            commenterId: userId,
            commenterName,
            commentPreview,
        } satisfies PostCommentEvent)
    }

    private createCommentPreview(content: string): string {
        const plainText = stripHtmlTags(content)
        return plainText.length > 100
            ? `${plainText.slice(0, 100)}...`
            : plainText
    }
}
