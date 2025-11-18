import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common"
import { PostLikeRepository } from "../../repositories/post-like.repository"
import { PostRepository } from "../../repositories/post.repository"
import { PostCacheService } from "./post-cache.service"
import { PostLikeQueue, LikeAction, PostLikeJob } from "@libs/queue"

export interface LikeQueueResponse {
    success: boolean
    message: string
    isLiked: boolean
    tempLikeCount?: number
}

@Injectable()
export class PostLikeService {
    constructor(
        private readonly postLikeRepository: PostLikeRepository,
        private readonly postRepository: PostRepository,
        private readonly postCacheService: PostCacheService,
        private readonly postLikeQueue: PostLikeQueue,
    ) {}

    async likePost(postId: string, userId: string) {
        let post = await this.postCacheService.getPost(postId)
        if (!post) {
            post = await this.postRepository.findPostById(postId)
            if (!post) {
                throw new NotFoundException(
                    `Post with ID ${postId} does not exist`,
                )
            }
        }

        const alreadyLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (alreadyLiked) {
            throw new BadRequestException("You already liked this post")
        }

        const jobData: PostLikeJob = {
            action: LikeAction.LIKE,
            postId,
            userId,
            timestamp: Date.now(),
        }

        try {
            await this.postLikeQueue.addLikeJob(jobData)
        } catch (error) {
            return await this.likeSyncFallback(postId, userId)
        }

        const tempLikeCount =
            await this.postCacheService.incrementDistributedLikeCounter(postId)

        await this.postCacheService.deletePost(postId)

        return {
            success: true,
            message: "Liked",
            isLiked: true,
            likeCount: tempLikeCount,
            isOptimistic: true
        }
    }

    async unlikePost(postId: string, userId: string) {
        let post = await this.postCacheService.getPost(postId)
        if (!post) {
            post = await this.postRepository.findPostById(postId)
            if (!post) {
                throw new NotFoundException(
                    `Post with ID ${postId} does not exist`,
                )
            }
        }

        const hasLiked = await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
        if (!hasLiked) {
            throw new BadRequestException(
                "You have not liked this post yet.",
            )
        }

        const jobData: PostLikeJob = {
            action: LikeAction.UNLIKE,
            postId,
            userId,
            timestamp: Date.now(),
        }

        try {
            await this.postLikeQueue.addLikeJob(jobData)
        } catch (error) {
            return await this.unlikeSyncFallback(postId, userId)
        }

        const tempLikeCount =
            await this.postCacheService.decrementDistributedLikeCounter(postId)

        await this.postCacheService.deletePost(postId)

        return {
            success: true,
            message: "Unliked",
            isLiked: false,
            likeCount: tempLikeCount,
            isOptimistic: true
        }
    }

    private async likeSyncFallback(postId: string, userId: string) {
        const result = await this.postLikeRepository.likePost(postId, userId)

        await Promise.all([
            this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            ),
            this.postCacheService.deletePost(postId),
        ])

        return {
            success: true,
            message: "Liked (sync)",
            isLiked: true,
            likeCount: result.likeCount,
            isOptimistic: false
        }
    }

    private async unlikeSyncFallback(postId: string, userId: string) {

        const result = await this.postLikeRepository.unlikePost(postId, userId)

        await Promise.all([
            this.postCacheService.initializeDistributedLikeCounter(
                postId,
                result.likeCount,
            ),
            this.postCacheService.deletePost(postId),
        ])

        return {
            success: true,
            message: "Unliked (sync)",
            isLiked: false,
            likeCount: result.likeCount,
            isOptimistic: false
        }
    }

    async checkIfLiked(postId: string, userId: string): Promise<boolean> {
        return await this.postLikeRepository.checkIfUserLikedPost(
            postId,
            userId,
        )
    }

    async getPostLikes(postId: string, limit: number = 20, offset: number = 0) {
        const post = await this.postRepository.findPostById(postId)
        if (!post) {
            throw new NotFoundException(`Post with ${postId} does not exists`)
        }

        return await this.postLikeRepository.getPostLikes(postId, limit, offset)
    }
}
