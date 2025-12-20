import { OnEvent } from "@nestjs/event-emitter"
import {
    EntityType,
    NotificationPriority,
    NotificationType,
} from "../../domain/enums/notification"
import { NotificationQueue } from "../workers/notification"
import { Injectable } from "@nestjs/common"
import {
    PostCommentEvent,
    PostLikeEvent,
    PostReplyEvent,
    PostUnlikeEvent,
} from "../../domain/events"
import { NotificationService } from "../services/notification"

@Injectable()
export class PostNotificationHandler {
    constructor(
        private readonly notificationQueue: NotificationQueue,
        private readonly notificationService: NotificationService,
    ) {}

    @OnEvent("post.liked")
    async handlePostLike(event: PostLikeEvent) {
        if (event.likerId === event.postAuthorId) {
            return
        }

        await this.notificationQueue.addNotificationJob({
            eventId: `post-like-${event.postId}`,
            priority: NotificationPriority.LOW,
            type: NotificationType.POST_LIKE,
            userId: event.postAuthorId,
            actorId: event.likerId,
            entityType: EntityType.POST,
            entityId: event.postId,
            data: {
                postId: event.postId,
                postTitle: event.postTitle,
                likeCount: event.likeCount,
                latestLikerName: event.likerName,
            },
            timestamp: new Date().toISOString(),
            delaySeconds: 10,
        })
    }

    @OnEvent("post.unliked")
    async handlePostUnlike(event: PostUnlikeEvent) {
        if (event.unlikerId === event.postAuthorId) {
            return
        }

        if (event.likeCount === 0) {
            await this.notificationService.deleteNotificationByEntityId(
                event.postId,
                event.postAuthorId,
            )
            return
        }

        await this.notificationQueue.addNotificationJob({
            eventId: `post-like-${event.postId}`,
            priority: NotificationPriority.LOW,
            type: NotificationType.POST_LIKE,
            userId: event.postAuthorId,
            actorId: event.unlikerId,
            entityType: EntityType.POST,
            entityId: event.postId,
            data: {
                postId: event.postId,
                postTitle: event.postTitle,
                likeCount: event.likeCount,
                latestLikerName: event.latestLikerName,
            },
            timestamp: new Date().toISOString(),
            delaySeconds: 10,
        })
    }

    @OnEvent("post.commented")
    async handlePostComment(event: PostCommentEvent) {
        if (event.commenterId === event.postAuthorId) {
            return
        }

        await this.notificationQueue.addNotificationJob({
            eventId: `post-comment-${event.commentId}`,
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.POST_COMMENT,
            userId: event.postAuthorId,
            actorId: event.commenterId,
            entityType: EntityType.COMMENT,
            entityId: event.commentId,
            data: {
                postId: event.postId,
                postTitle: event.postTitle,
                commentId: event.commentId,
                commenterName: event.commenterName,
                commentPreview: event.commentPreview,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("comment.replied")
    async handleCommentReply(event: PostReplyEvent) {
        if (event.replierId === event.parentCommentAuthorId) {
            return
        }

        await this.notificationQueue.addNotificationJob({
            eventId: `comment-reply-${event.replyId}`,
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.POST_REPLY,
            userId: event.parentCommentAuthorId,
            actorId: event.replierId,
            entityType: EntityType.COMMENT,
            entityId: event.replyId,
            data: {
                postId: event.postId,
                postTitle: event.postTitle,
                commentId: event.replyId,
                parentCommentId: event.parentCommentId,
                replierName: event.replierName,
                replyPreview: event.replyPreview,
            },
            timestamp: new Date().toISOString(),
        })
    }
}
