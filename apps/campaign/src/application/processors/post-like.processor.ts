import {
    Process,
    Processor,
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
} from "@nestjs/bull"
import { Logger } from "@nestjs/common"
import { Job } from "bull"
import tracer from "dd-trace"
import {
    QUEUE_NAMES,
    PostLikeJob,
    LikeAction,
    BullDatadogService,
} from "@libs/queue"
import { PostLikeRepository } from "../repositories/post-like.repository"
import { PostCacheService } from "../services/post/post-cache.service"

@Processor(QUEUE_NAMES.POST_LIKES)
export class PostLikeProcessor {
    private readonly logger = new Logger(PostLikeProcessor.name)

    constructor(
        private readonly postLikeRepository: PostLikeRepository,
        private readonly postCacheService: PostCacheService,
        private readonly bullDatadog: BullDatadogService,
    ) {}

    @Process("process-like")
    async handleLike(job: Job<PostLikeJob>) {
        const span = tracer.scope().active()
        const startTime = Date.now()

        // Add Datadog trace tags
        span?.setTag("job.id", job.id)
        span?.setTag("job.queue", "post-likes")
        span?.setTag("job.data.postId", job.data.postId)
        span?.setTag("job.data.userId", job.data.userId)
        span?.setTag("job.data.action", job.data.action)

        try {
            this.bullDatadog.trackJobStart("post-likes", job.id.toString())

            const { postId, userId, action } = job.data

            this.logger.log(
                `Processing ${action} for post ${postId} by user ${userId}`,
            )

            if (action === LikeAction.LIKE) {
                await this.processLike(postId, userId)
            } else if (action === LikeAction.UNLIKE) {
                await this.processUnlike(postId, userId)
            } else {
                this.logger.warn(`Unknown action: ${action}`)
                return { success: false, error: "Unknown action" }
            }

            const duration = Date.now() - startTime
            this.bullDatadog.trackJobComplete(
                "post-likes",
                job.id.toString(),
                duration,
            )

            span?.setTag("job.status", "completed")
            return { success: true, duration }
        } catch (error) {
            this.bullDatadog.trackJobFailed(
                "post-likes",
                job.id.toString(),
                error,
            )
            span?.setTag("job.status", "failed")
            span?.setTag("error", true)
            throw error
        }
    }

    private async processLike(postId: string, userId: string): Promise<void> {
        const alreadyLiked =
            await this.postLikeRepository.checkIfUserLikedPost(postId, userId)

        if (alreadyLiked) {
            this.logger.debug(`User ${userId} already liked post ${postId}`)
            return
        }

        const result = await this.postLikeRepository.likePost(postId, userId)

        await this.postCacheService.initializeDistributedLikeCounter(
            postId,
            result.likeCount,
        )
        await this.postCacheService.deletePost(postId)
    }

    private async processUnlike(
        postId: string,
        userId: string,
    ): Promise<void> {
        const hasLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )

        if (!hasLiked) {
            this.logger.debug(`User ${userId} has not liked post ${postId}`)
            return
        }

        const result = await this.postLikeRepository.unlikePost(postId, userId)

        await this.postCacheService.initializeDistributedLikeCounter(
            postId,
            result.likeCount,
        )
        await this.postCacheService.deletePost(postId)
    }

    @OnQueueActive()
    onActive(job: Job) {
        // Silent - only log errors
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        // Silent - only log errors
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `Job ${job.id} failed: ${error.message}`,
            error.stack,
        )
    }
}
