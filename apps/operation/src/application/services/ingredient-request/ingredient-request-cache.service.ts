import { createHash } from "crypto"
import { IngredientRequestFilterInput } from "../../dtos"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { IngredientRequest } from "@app/operation/src/domain"

export interface IngredientRequestListCacheKey {
    filter?: IngredientRequestFilterInput
    limit: number
    offset: number
}

@Injectable()
export class IngredientRequestCacheService {
    private readonly TTL = {
        SINGLE_REQUEST: 60 * 30, // 30 minutes
        REQUEST_LIST: 60 * 15, // 15 minutes
        PHASE_REQUESTS: 60 * 30, // 30 minutes
        CAMPAIGN_REQUESTS: 60 * 30, // 30 minutes
        USER_REQUESTS: 60 * 30, // 30 minutes
        STATS: 60 * 10, // 10 minutes
    }

    private readonly KEYS = {
        SINGLE: "ingredient-request",
        LIST: "ingredient-requests:list",
        PHASE: "ingredient-requests:phase",
        CAMPAIGN: "ingredient-requests:campaign",
        USER: "ingredient-requests:user",
        STATS: "ingredient-requests:stats",
    }

    constructor(private readonly redis: RedisService) {}

    // ==================== Single Ingredient Request ====================

    async getRequest(id: string): Promise<IngredientRequest | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as IngredientRequest
        }

        return null
    }

    async setRequest(id: string, request: IngredientRequest): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(request), {
            ex: this.TTL.SINGLE_REQUEST,
        })
    }

    async deleteRequest(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    // ==================== Request Lists ====================

    private generateListCacheKey(
        params: IngredientRequestListCacheKey,
    ): string {
        const normalized = {
            filter: params.filter || {},
            limit: params.limit,
            offset: params.offset,
        }

        const hash = createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex")
            .substring(0, 16)

        return `${this.KEYS.LIST}:${hash}`
    }

    async getRequestList(
        params: IngredientRequestListCacheKey,
    ): Promise<IngredientRequest[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as IngredientRequest[]
        }

        return null
    }

    async setRequestList(
        params: IngredientRequestListCacheKey,
        requests: IngredientRequest[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(requests), {
            ex: this.TTL.REQUEST_LIST,
        })
    }

    async deleteAllRequestLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Phase Requests ====================

    async getPhaseRequests(
        campaignPhaseId: string,
        limit: number,
        offset: number,
    ): Promise<IngredientRequest[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as IngredientRequest[]
        }

        return null
    }

    async setPhaseRequests(
        campaignPhaseId: string,
        limit: number,
        offset: number,
        requests: IngredientRequest[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(requests), {
            ex: this.TTL.PHASE_REQUESTS,
        })
    }

    async deletePhaseRequests(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.PHASE}:${campaignPhaseId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Requests ====================

    async getCampaignRequests(
        campaignId: string,
        limit: number,
        offset: number,
    ): Promise<IngredientRequest[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as IngredientRequest[]
        }

        return null
    }

    async setCampaignRequests(
        campaignId: string,
        limit: number,
        offset: number,
        requests: IngredientRequest[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(requests), {
            ex: this.TTL.CAMPAIGN_REQUESTS,
        })
    }

    async deleteCampaignRequests(campaignId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.CAMPAIGN}:${campaignId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== User Requests (Kitchen Staff) ====================

    async getUserRequests(
        userId: string,
        limit: number,
        offset: number,
    ): Promise<IngredientRequest[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.USER}:${userId}:${limit}:${offset}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as IngredientRequest[]
        }

        return null
    }

    async setUserRequests(
        userId: string,
        limit: number,
        offset: number,
        requests: IngredientRequest[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${userId}:${limit}:${offset}`
        await this.redis.set(key, JSON.stringify(requests), {
            ex: this.TTL.USER_REQUESTS,
        })
    }

    async deleteUserRequests(userId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.USER}:${userId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Statistics ====================

    async getStats(): Promise<{
        totalRequests: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    } | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.STATS}:global`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached)
        }

        return null
    }

    async setStats(stats: {
        totalRequests: number
        pendingCount: number
        approvedCount: number
        rejectedCount: number
    }): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:global`
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.STATS,
        })
    }

    async deleteStats(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:global`
        await this.redis.del(key)
    }

    // ==================== Invalidation ====================

    async invalidateRequest(
        requestId: string,
        campaignPhaseId?: string,
        userId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deleteRequest(requestId),
            this.deleteAllRequestLists(),
            this.deleteStats(),
        ]

        if (campaignPhaseId) {
            deleteOperations.push(this.deletePhaseRequests(campaignPhaseId))
        }

        if (userId) {
            deleteOperations.push(this.deleteUserRequests(userId))
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
            `${this.KEYS.PHASE}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.USER}:*`,
            `${this.KEYS.STATS}:*`,
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

        const keys = await this.redis.keys("ingredient-request*")
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}
