import { PostSortOrder } from "@app/campaign/src/domain/enums/post/post.enum"
import { PostFilterInput } from "../../dtos/post/request"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { Post } from "@app/campaign/src/domain/entities/post.model"
import { createHash } from "crypto"
import { PostComment } from "@app/campaign/src/domain/entities/post-comment.model"

export interface PostListCacheKey {
    filter?: PostFilterInput
    search?: string
    sortBy?: PostSortOrder
    limit: number
    offset: number
}

@Injectable()
export class PostCacheService {
    private readonly TTL = {
        SINGLE_POST: 60 * 30, // 30 minutes
        POST_LIST: 60 * 15, // 15 minutes
        CAMPAIGN_POSTS: 60 * 30, // 30 minutes
        USER_POSTS: 60 * 30, // 30 minutes
        POST_COMMENTS: 60 * 15, // 15 minutes
        POST_LIKES_COUNT: 60 * 5, // 5 minutes
        POST_COMMENTS_COUNT: 60 * 5, // 5 minutes
    }

    private readonly KEYS = {
        SINGLE: "post",
        LIST: "posts:list",
        CAMPAIGN: "posts:campaign",
        USER: "posts:user",
        COMMENTS: "post:comments",
        LIKES_COUNT: "post:likes:count",
        COMMENTS_COUNT: "post:comments:count",
    }

    constructor(private readonly redis: RedisService) {}

    // ==================== Single Post ====================

    async getPost(id: string): Promise<Post | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as Post
        }

        return null
    }

    async setPost(id: string, post: Post): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(post), {
            ex: this.TTL.SINGLE_POST,
        })
    }

    async deletePost(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    // ==================== Post Lists ====================

    private generateListCacheKey(params: PostListCacheKey): string {
        const normalized = {
            filter: params.filter || {},
            search: params.search || "",
            sortBy: params.sortBy,
            limit: params.limit,
            offset: params.offset,
        }

        const hash = createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex")
            .substring(0, 16)

        return `${this.KEYS.LIST}:${hash}`
    }

    async getPostList(params: PostListCacheKey): Promise<Post[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as Post[]
        }

        return null
    }

    async setPostList(params: PostListCacheKey, posts: Post[]): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(posts), {
            ex: this.TTL.POST_LIST,
        })
    }

    async deleteAllPostLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Posts ====================

    async getCampaignPosts(campaignId: string): Promise<Post[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as Post[]
        }

        return null
    }

    async setCampaignPosts(campaignId: string, posts: Post[]): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.set(key, JSON.stringify(posts), {
            ex: this.TTL.CAMPAIGN_POSTS,
        })
    }

    async deleteCampaignPosts(campaignId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.del(key)
    }

    // ==================== User Posts ====================

    async getUserPosts(userId: string): Promise<Post[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.USER}:${userId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as Post[]
        }

        return null
    }

    async setUserPosts(userId: string, posts: Post[]): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${userId}`
        await this.redis.set(key, JSON.stringify(posts), {
            ex: this.TTL.USER_POSTS,
        })
    }

    async deleteUserPosts(userId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${userId}`
        await this.redis.del(key)
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

    // ==================== Post Counters ====================

    async getLikesCount(postId: string): Promise<number | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return parseInt(cached, 10)
        }

        return null
    }

    async setLikesCount(postId: string, count: number): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        await this.redis.set(key, count.toString(), {
            ex: this.TTL.POST_LIKES_COUNT,
        })
    }

    async incrementLikesCount(postId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        const current = await this.getLikesCount(postId)

        if (current !== null) {
            await this.setLikesCount(postId, current + 1)
        }
    }

    async decrementLikesCount(postId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        const current = await this.getLikesCount(postId)

        if (current !== null && current > 0) {
            await this.setLikesCount(postId, current - 1)
        }
    }

    async incrementDistributedLikeCounter(postId: string): Promise<number> {
        if (!this.redis.isAvailable()) {
            return 0
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`

        const newCount = await this.redis.incr(key)

        if (newCount === 1) {
            await this.redis.expire(key, this.TTL.POST_LIKES_COUNT)
        }

        return newCount
    }

    async decrementDistributedLikeCounter(postId: string): Promise<number> {
        if (!this.redis.isAvailable()) {
            return 0
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`

        const newCount = await this.redis.decr(key)

        if (newCount < 0) {
            await this.redis.set(key, "0", {
                ex: this.TTL.POST_LIKES_COUNT,
            })
            return 0
        }

        return newCount
    }

    async getDistributedLikeCounter(postId: string): Promise<number | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return parseInt(cached, 10)
        }

        return null
    }

    async initializeDistributedLikeCounter(
        postId: string,
        count: number,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.LIKES_COUNT}:${postId}`
        await this.redis.set(key, count.toString(), {
            ex: this.TTL.POST_LIKES_COUNT,
        })
    }

    async getCommentsCount(postId: string): Promise<number | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.COMMENTS_COUNT}:${postId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return parseInt(cached, 10)
        }

        return null
    }

    async setCommentsCount(postId: string, count: number): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.COMMENTS_COUNT}:${postId}`
        await this.redis.set(key, count.toString(), {
            ex: this.TTL.POST_COMMENTS_COUNT,
        })
    }

    async incrementCommentsCount(postId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const current = await this.getCommentsCount(postId)

        if (current !== null) {
            await this.setCommentsCount(postId, current + 1)
        }
    }

    async decrementCommentsCount(postId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const current = await this.getCommentsCount(postId)

        if (current !== null && current > 0) {
            await this.setCommentsCount(postId, current - 1)
        }
    }

    // ==================== Invalidation ====================

    async invalidatePost(
        postId: string,
        campaignId?: string,
        userId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deletePost(postId),
            this.deleteAllPostLists(),
            this.deletePostComments(postId),
        ]

        if (campaignId) {
            deleteOperations.push(this.deleteCampaignPosts(campaignId))
        }

        if (userId) {
            deleteOperations.push(this.deleteUserPosts(userId))
        }

        await Promise.all(deleteOperations)
    }

    async invalidateAll(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const patterns = [
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.USER}:*`,
            `${this.KEYS.COMMENTS}:*`,
            `${this.KEYS.LIKES_COUNT}:*`,
            `${this.KEYS.COMMENTS_COUNT}:*`,
        ]

        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern)
            if (keys.length > 0) {
                await this.redis.del(keys)
            }
        }
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        const isAvailable = this.redis.isAvailable()

        if (!isAvailable) {
            return { available: false, keysCount: 0 }
        }

        const keys = await this.redis.keys("post*")
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}
