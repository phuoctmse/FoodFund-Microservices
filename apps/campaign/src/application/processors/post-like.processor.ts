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
import { QUEUE_NAMES, BullDatadogService, JOB_TYPES } from "@libs/queue"
import { PostLikeRepository } from "../repositories/post-like.repository"
import { PostCacheService } from "../services/post/post-cache.service"
import { LikeAction, PostLikeJob } from "../../domain/interfaces/post"
import { PostLikeEvent, PostUnlikeEvent } from "../../domain/events"
import { PostRepository } from "../repositories/post.repository"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { UserClientService } from "../../shared"

@Processor(QUEUE_NAMES.CAMPAIGN_JOBS)
export class PostLikeProcessor {
    private readonly logger = new Logger(PostLikeProcessor.name)

    constructor(
        private readonly postLikeRepository: PostLikeRepository,
        private readonly postRepository: PostRepository,
        private readonly postCacheService: PostCacheService,
        private readonly bullDatadog: BullDatadogService,
        private readonly eventEmitter: EventEmitter2,
        private readonly userClient: UserClientService,
    ) {}

    @Process(JOB_TYPES.POST_LIKE)
    async handleLike(job: Job<PostLikeJob>) {
        const span = tracer.scope().active()
        const startTime = Date.now()

        span?.setTag("job.id", job.id)
        span?.setTag("job.queue", QUEUE_NAMES.CAMPAIGN_JOBS)
        span?.setTag("job.type", JOB_TYPES.POST_LIKE)
        span?.setTag("job.data.postId", job.data.postId)
        span?.setTag("job.data.userId", job.data.userId)
        span?.setTag("job.data.action", job.data.action)

        try {
            this.bullDatadog.trackJobStart(
                QUEUE_NAMES.CAMPAIGN_JOBS,
                job.id.toString(),
            )

            const { postId, userId, action } = job.data

            if (action === LikeAction.LIKE) {
                await this.processLike(postId, userId)
            } else if (action === LikeAction.UNLIKE) {
                await this.processUnlike(postId, userId)
            } else {
                throw new Error(`Unknown action: ${action}`)
            }

            const duration = Date.now() - startTime
            this.bullDatadog.trackJobComplete(
                "post-likes",
                job.id.toString(),
                duration,
            )

            span?.setTag("job.status", "completed")
            this.logger.log(`✅ Job ${job.id} completed in ${duration}ms`)

            return { success: true, duration }
        } catch (error) {
            this.logger.error(`❌ Job ${job.id} failed:`, error)
            this.logger.error("Error details:", {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                jobData: job.data,
            })
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
        const cachedCount =
            await this.postCacheService.getDistributedLikeCounter(postId)

        if (cachedCount === null) {
            const dbCount = await this.postLikeRepository.getLikeCount(postId)
            await this.postCacheService.initializeDistributedLikeCounter(
                postId,
                dbCount,
            )
        }
        const alreadyLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )

        if (alreadyLiked) {
            return
        }

        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new Error(`Post ${postId} not found`)
        }

        const result = await this.postLikeRepository.likePost(postId, userId)
        await Promise.all([
            this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            ),
            this.postCacheService.deleteAllPostLists(),
        ])

        if (post.createdBy !== userId) {
            const likerName = await this.userClient.getUserDisplayName(userId)

            this.eventEmitter.emit("post.liked", {
                postId: post.id,
                postTitle: post.title,
                postAuthorId: post.createdBy,
                likerId: userId,
                likerName,
                likeCount: result.likeCount,
            } satisfies PostLikeEvent)
        }
    }

    private async processUnlike(postId: string, userId: string): Promise<void> {
        const cachedCount = await this.postCacheService.getDistributedLikeCounter(postId)

        if (cachedCount === null) {
            const dbCount = await this.postLikeRepository.getLikeCount(postId)
            await this.postCacheService.initializeDistributedLikeCounter(
                postId,
                dbCount,
            )
        }
        const hasLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )

        if (!hasLiked) {
            return
        }

        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new Error(`Post ${postId} not found`)
        }

        const result = await this.postLikeRepository.unlikePost(postId, userId)

        await Promise.all([
            this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            ),
            this.postCacheService.deleteAllPostLists(),
        ])

        if (post.createdBy !== userId) {
            let latestLikerName = "Someone"
            if (result.likeCount > 0) {
                const latestLike =
                    await this.postLikeRepository.getLatestLike(postId)
                if (latestLike) {
                    latestLikerName = await this.userClient.getUserDisplayName(
                        latestLike.userId,
                    )
                }
            }

            this.eventEmitter.emit("post.unliked", {
                postId: post.id,
                postTitle: post.title,
                postAuthorId: post.createdBy,
                unlikerId: userId,
                likeCount: result.likeCount,
                latestLikerName,
            } satisfies PostUnlikeEvent)
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`Job ${job.id} is now active`)
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.log(`Job ${job.id} completed with result:`, result)
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack)
    }
}
