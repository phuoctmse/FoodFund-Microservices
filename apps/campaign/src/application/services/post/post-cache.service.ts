import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { Post } from "@app/campaign/src/domain/entities/post.model"
import { BaseCacheService } from "@app/campaign/src/shared/services"
import { PostComment } from "@app/campaign/src/domain/entities/post-comment.model"

export interface PostListCacheKey {
    campaignId?: string
    userId?: string
    sortOrder?: string
    limit?: number
    offset?: number
}

@Injectable()
export class PostCacheService extends BaseCacheService<Post> {
    protected readonly TTL = {
        SINGLE_POST: 60 * 30, // 30 minutes
        POST_LIST: 60 * 15, // 15 minutes
        CAMPAIGN_POSTS: 60 * 30, // 30 minutes
        USER_POSTS: 60 * 30, // 30 minutes
        LIKE_COUNTER: 60 * 60, // 1 hour
        POST_COMMENTS: 60 * 30, // 30 minutes
        COMMENT_COUNTER: 60 * 60, // 1 hour
    }

    protected readonly KEYS = {
        SINGLE: "post",
        LIST: "posts:list",
        CAMPAIGN: "posts:campaign",
        USER: "posts:user",
        LIKE_COUNTER: "post:like-counter",
        COMMENTS: "post:comments",
        COMMENT_COUNTER: "post:comment-counter",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Post ====================

    async getPost(id: string): Promise<Post | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setPost(id: string, post: Post): Promise<void> {
        return this.setSingle(this.KEYS.SINGLE, id, post, this.TTL.SINGLE_POST)
    }

    async deletePost(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Post Lists ====================

    async getPostList(params: PostListCacheKey): Promise<Post[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setPostList(params: PostListCacheKey, posts: Post[]): Promise<void> {
        return this.setList(this.KEYS.LIST, params, posts, this.TTL.POST_LIST)
    }

    async deleteAllPostLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== Campaign Posts ====================

    async getCampaignPosts(campaignId: string): Promise<Post[] | null> {
        return this.getRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    async setCampaignPosts(
        campaignId: string,
        posts: Post[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.CAMPAIGN,
            campaignId,
            posts,
            this.TTL.CAMPAIGN_POSTS,
        )
    }

    async deleteCampaignPosts(campaignId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    // ==================== User Posts ====================

    async getUserPosts(userId: string): Promise<Post[] | null> {
        return this.getRelatedList(this.KEYS.USER, userId)
    }

    async setUserPosts(userId: string, posts: Post[]): Promise<void> {
        return this.setRelatedList(
            this.KEYS.USER,
            userId,
            posts,
            this.TTL.USER_POSTS,
        )
    }

    async deleteUserPosts(userId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.USER, userId)
    }

    // ==================== Post Comments ====================

    async getPostComments(postId: string): Promise<PostComment[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.COMMENTS}:${postId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as PostComment[]
        }

        return null
    }

    async setPostComments(
        postId: string,
        comments: PostComment[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.COMMENTS}:${postId}`
        await this.redis.set(key, JSON.stringify(comments), {
            ex: this.TTL.POST_COMMENTS,
        })
    }

    async deletePostComments(postId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.COMMENTS}:${postId}`
        await this.redis.del(key)
    }

    // ==================== Comment Counter ====================

    async getCommentsCount(postId: string): Promise<number | null> {
        return this.getCounter(this.KEYS.COMMENT_COUNTER, postId)
    }

    async initializeCommentsCount(
        postId: string,
        count: number,
    ): Promise<void> {
        return this.setCounter(
            this.KEYS.COMMENT_COUNTER,
            postId,
            count,
            this.TTL.COMMENT_COUNTER,
        )
    }

    async incrementCommentsCount(postId: string): Promise<number> {
        return this.incrementCounter(
            this.KEYS.COMMENT_COUNTER,
            postId,
            this.TTL.COMMENT_COUNTER,
        )
    }

    async decrementCommentsCount(postId: string): Promise<number> {
        return this.decrementCounter(
            this.KEYS.COMMENT_COUNTER,
            postId,
            this.TTL.COMMENT_COUNTER,
        )
    }

    // ==================== Like Counter (Distributed) ====================

    async getDistributedLikeCounter(postId: string): Promise<number | null> {
        return this.getCounter(this.KEYS.LIKE_COUNTER, postId)
    }

    async initializeDistributedLikeCounter(
        postId: string,
        likeCount: number,
    ): Promise<void> {
        return this.setCounter(
            this.KEYS.LIKE_COUNTER,
            postId,
            likeCount,
            this.TTL.LIKE_COUNTER,
        )
    }

    async incrementDistributedLikeCounter(postId: string): Promise<number> {
        return this.incrementCounter(
            this.KEYS.LIKE_COUNTER,
            postId,
            this.TTL.LIKE_COUNTER,
        )
    }

    async decrementDistributedLikeCounter(postId: string): Promise<number> {
        return this.decrementCounter(
            this.KEYS.LIKE_COUNTER,
            postId,
            this.TTL.LIKE_COUNTER,
        )
    }

    // ==================== Invalidation ====================

    async invalidatePost(
        postId: string,
        campaignId?: string,
        userId?: string,
    ): Promise<void> {
        const operations: Promise<void>[] = [
            this.deletePost(postId),
            this.deletePostComments(postId),
            this.deleteAllPostLists(),
        ]

        if (campaignId) {
            operations.push(this.deleteCampaignPosts(campaignId))
        }

        if (userId) {
            operations.push(this.deleteUserPosts(userId))
        }

        return this.invalidateMultiple(...operations)
    }

    async invalidateAll(): Promise<void> {
        return this.invalidateByPatterns(
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.USER}:*`,
            `${this.KEYS.LIKE_COUNTER}:*`,
            `${this.KEYS.COMMENTS}:*`,
            `${this.KEYS.COMMENT_COUNTER}:*`,
        )
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("post*")
    }
}