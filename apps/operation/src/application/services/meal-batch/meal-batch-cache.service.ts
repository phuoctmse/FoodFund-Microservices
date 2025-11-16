import { createHash } from "crypto"
import { MealBatchFilterInput } from "../../dtos"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { MealBatch } from "@app/operation/src/domain"

export interface MealBatchListCacheKey {
    filter?: MealBatchFilterInput
}

@Injectable()
export class MealBatchCacheService {
    private readonly TTL = {
        SINGLE_BATCH: 60 * 30, // 30 minutes
        BATCH_LIST: 60 * 15, // 15 minutes
        PHASE_BATCHES: 60 * 30, // 30 minutes
        CAMPAIGN_BATCHES: 60 * 30, // 30 minutes
        USER_BATCHES: 60 * 30, // 30 minutes
        STATS: 60 * 10, // 10 minutes
    }

    private readonly KEYS = {
        SINGLE: "meal-batch",
        LIST: "meal-batches:list",
        PHASE: "meal-batches:phase",
        CAMPAIGN: "meal-batches:campaign",
        USER: "meal-batches:user",
        STATS: "meal-batches:stats",
    }

    constructor(private readonly redis: RedisService) {}

    // ==================== Single Meal Batch ====================

    async getBatch(id: string): Promise<MealBatch | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as MealBatch
        }

        return null
    }

    async setBatch(id: string, batch: MealBatch): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(batch), {
            ex: this.TTL.SINGLE_BATCH,
        })
    }

    async deleteBatch(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    // ==================== Batch Lists ====================

    private generateListCacheKey(params: MealBatchListCacheKey): string {
        const normalized = {
            filter: params.filter || {},
        }

        const hash = createHash("sha256")
            .update(JSON.stringify(normalized))
            .digest("hex")
            .substring(0, 16)

        return `${this.KEYS.LIST}:${hash}`
    }

    async getBatchList(
        params: MealBatchListCacheKey,
    ): Promise<MealBatch[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as MealBatch[]
        }

        return null
    }

    async setBatchList(
        params: MealBatchListCacheKey,
        batches: MealBatch[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(batches), {
            ex: this.TTL.BATCH_LIST,
        })
    }

    async deleteAllBatchLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Campaign Phase Batches ====================

    async getPhaseBatches(
        campaignPhaseId: string,
    ): Promise<MealBatch[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as MealBatch[]
        }

        return null
    }

    async setPhaseBatches(
        campaignPhaseId: string,
        batches: MealBatch[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        await this.redis.set(key, JSON.stringify(batches), {
            ex: this.TTL.PHASE_BATCHES,
        })
    }

    async deletePhaseBatches(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.PHASE}:${campaignPhaseId}`
        await this.redis.del(key)
    }

    // ==================== Campaign Batches ====================

    async getCampaignBatches(campaignId: string): Promise<MealBatch[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as MealBatch[]
        }

        return null
    }

    async setCampaignBatches(
        campaignId: string,
        batches: MealBatch[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.set(key, JSON.stringify(batches), {
            ex: this.TTL.CAMPAIGN_BATCHES,
        })
    }

    async deleteCampaignBatches(campaignId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.CAMPAIGN}:${campaignId}`
        await this.redis.del(key)
    }

    // ==================== Kitchen Staff Batches ====================

    async getUserBatches(kitchenStaffId: string): Promise<MealBatch[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.USER}:${kitchenStaffId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as MealBatch[]
        }

        return null
    }

    async setUserBatches(
        kitchenStaffId: string,
        batches: MealBatch[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${kitchenStaffId}`
        await this.redis.set(key, JSON.stringify(batches), {
            ex: this.TTL.USER_BATCHES,
        })
    }

    async deleteUserBatches(kitchenStaffId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${kitchenStaffId}`
        await this.redis.del(key)
    }

    // ==================== Statistics ====================

    async getPhaseStats(campaignPhaseId: string): Promise<{
        totalBatches: number
        preparingCount: number
        readyCount: number
        deliveredCount: number
        totalPortions: number
    } | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached)
        }

        return null
    }

    async setPhaseStats(
        campaignPhaseId: string,
        stats: {
            totalBatches: number
            preparingCount: number
            readyCount: number
            deliveredCount: number
            totalPortions: number
        },
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.STATS,
        })
    }

    async deletePhaseStats(campaignPhaseId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.STATS}:phase:${campaignPhaseId}`
        await this.redis.del(key)
    }

    // ==================== Invalidation ====================

    async invalidateBatch(
        batchId: string,
        campaignPhaseId?: string,
        kitchenStaffId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deleteBatch(batchId),
            this.deleteAllBatchLists(),
        ]

        if (campaignPhaseId) {
            deleteOperations.push(this.deletePhaseBatches(campaignPhaseId))
            deleteOperations.push(this.deletePhaseStats(campaignPhaseId))
        }

        if (kitchenStaffId) {
            deleteOperations.push(this.deleteUserBatches(kitchenStaffId))
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

        const keys = await this.redis.keys("meal-batch*")
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}
