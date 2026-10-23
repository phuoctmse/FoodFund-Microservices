import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { PostLikeRepository } from "../../repositories/post-like.repository"
import { PostRepository } from "../../repositories/post.repository"
import { PostCacheService } from "./post-cache.service"
import { PostLikeQueue } from "../../workers/post-like"
import {
    LikeAction,
    PostLikeJob,
} from "@app/campaign/src/domain/interfaces/post"

export interface LikeQueueResponse {
    success: boolean
    message: string
    isLiked: boolean
    likeCount: number
    isOptimistic: boolean
}

@Injectable()
export class PostLikeService {
    private readonly logger = new Logger(PostLikeService.name)

    constructor(
        private readonly postLikeRepository: PostLikeRepository,
        private readonly postRepository: PostRepository,
        private readonly postCacheService: PostCacheService,
        private readonly postLikeQueue: PostLikeQueue,
    ) {}

    async likePost(postId: string, userId: string): Promise<LikeQueueResponse> {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ID ${postId} does not exist`)
        }

        const alreadyLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (alreadyLiked) {
            throw new BadRequestException("You already liked this post")
        }
        await this.ensureCacheInitialized(postId)

        const jobData: PostLikeJob = {
            action: LikeAction.LIKE,
            postId,
            userId,
            timestamp: Date.now(),
        }

        try {
            await this.postLikeQueue.addLikeJob(jobData)
        } catch (queueError) {
            this.logger.warn(
                `Failed to add like job to queue for post ${postId}, falling back to sync operation`,
                {
                    error:
                        queueError instanceof Error
                            ? queueError.message
                            : String(queueError),
                    postId,
                    userId,
                    stack:
                        queueError instanceof Error
                            ? queueError.stack
                            : undefined,
                },
            )
            return await this.likeSyncFallback(postId, userId)
        }

        const tempLikeCount =
            await this.postCacheService.incrementDistributedLikeCounter(postId)

        return {
            success: true,
            message: "Liked",
            isLiked: true,
            likeCount: tempLikeCount,
            isOptimistic: true,
        }
    }

    async unlikePost(
        postId: string,
        userId: string,
    ): Promise<LikeQueueResponse> {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ID ${postId} does not exist`)
        }

        const hasLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (!hasLiked) {
            throw new BadRequestException("You have not liked this post yet")
        }

        await this.ensureCacheInitialized(postId)

        const jobData: PostLikeJob = {
            action: LikeAction.UNLIKE,
            postId,
            userId,
            timestamp: Date.now(),
        }

        try {
            await this.postLikeQueue.addLikeJob(jobData)
        } catch (queueError) {
            this.logger.warn(
                `Failed to add unlike job to queue for post ${postId}, falling back to sync operation`,
                {
                    error:
                        queueError instanceof Error
                            ? queueError.message
                            : String(queueError),
                    postId,
                    userId,
                    stack:
                        queueError instanceof Error
                            ? queueError.stack
                            : undefined,
                },
            )
            return await this.unlikeSyncFallback(postId, userId)
        }

        const tempLikeCount =
            await this.postCacheService.decrementDistributedLikeCounter(postId)

        return {
            success: true,
            message: "Unliked",
            isLiked: false,
            likeCount: tempLikeCount,
            isOptimistic: true,
        }
    }

    private async likeSyncFallback(
        postId: string,
        userId: string,
    ): Promise<LikeQueueResponse> {
        try {
            const result = await this.postLikeRepository.likePost(
                postId,
                userId,
            )

            await this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            )

            return {
                success: true,
                message: "Liked (sync)",
                isLiked: true,
                likeCount: result.likeCount,
                isOptimistic: false,
            }
        } catch (syncError) {
            this.logger.error(`Sync like fallback failed for post ${postId}`, {
                error:
                    syncError instanceof Error
                        ? syncError.message
                        : String(syncError),
                postId,
                userId,
                stack: syncError instanceof Error ? syncError.stack : undefined,
            })
            throw new BadRequestException(
                "Failed to like post. Please try again later.",
            )
        }
    }

    private async unlikeSyncFallback(
        postId: string,
        userId: string,
    ): Promise<LikeQueueResponse> {
        try {
            const result = await this.postLikeRepository.unlikePost(
                postId,
                userId,
            )

            await this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            )

            return {
                success: true,
                message: "Unliked (sync)",
                isLiked: false,
                likeCount: result.likeCount,
                isOptimistic: false,
            }
        } catch (syncError) {
            this.logger.error(
                `Sync unlike fallback failed for post ${postId}`,
                {
                    error:
                        syncError instanceof Error
                            ? syncError.message
                            : String(syncError),
                    postId,
                    userId,
                    stack:
                        syncError instanceof Error
                            ? syncError.stack
                            : undefined,
                },
            )
            throw new BadRequestException(
                "Failed to unlike post. Please try again later.",
            )
        }
    }

    async checkIfLiked(postId: string, userId: string): Promise<boolean> {
        return await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
    }

    async getPostLikes(postId: string, limit: number, offset: number) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ID ${postId} does not exist`)
        }

        return await this.postLikeRepository.getPostLikes(postId, limit, offset)
    }

    private async ensureCacheInitialized(postId: string): Promise<void> {
        const cachedCount =
            await this.postCacheService.getDistributedLikeCounter(postId)

        if (cachedCount === null) {
            const dbCount = await this.postLikeRepository.getLikeCount(postId)
            await this.postCacheService.initializeDistributedLikeCounter(
                postId,
                dbCount,
            )
        }
    }
}
