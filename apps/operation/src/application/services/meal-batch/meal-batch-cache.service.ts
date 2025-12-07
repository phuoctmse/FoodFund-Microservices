import { MealBatchFilterInput } from "../../dtos"
import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { MealBatch } from "@app/operation/src/domain"
import { BaseCacheService } from "@app/operation/src/shared/services"

export interface MealBatchListCacheKey {
    filter?: MealBatchFilterInput
}

@Injectable()
export class MealBatchCacheService extends BaseCacheService<MealBatch> {
    protected readonly TTL = {
        SINGLE_BATCH: 60 * 30,
        BATCH_LIST: 60 * 15,
        PHASE_BATCHES: 60 * 30,
        CAMPAIGN_BATCHES: 60 * 30,
        USER_BATCHES: 60 * 30,
        STATS: 60 * 10,
    }

    protected readonly KEYS = {
        SINGLE: "meal-batch",
        LIST: "meal-batches:list",
        PHASE: "meal-batches:phase",
        CAMPAIGN: "meal-batches:campaign",
        USER: "meal-batches:user",
        STATS: "meal-batches:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Meal Batch ====================

    async getBatch(id: string): Promise<MealBatch | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setBatch(id: string, batch: MealBatch): Promise<void> {
        return this.setSingle(
            this.KEYS.SINGLE,
            id,
            batch,
            this.TTL.SINGLE_BATCH,
        )
    }

    async deleteBatch(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Batch Lists ====================

    async getBatchList(
        params: MealBatchListCacheKey,
    ): Promise<MealBatch[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setBatchList(
        params: MealBatchListCacheKey,
        batches: MealBatch[],
    ): Promise<void> {
        return this.setList(
            this.KEYS.LIST,
            params,
            batches,
            this.TTL.BATCH_LIST,
        )
    }

    async deleteAllBatchLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== Campaign Phase Batches ====================

    async getPhaseBatches(
        campaignPhaseId: string,
    ): Promise<MealBatch[] | null> {
        return this.getRelatedList(this.KEYS.PHASE, campaignPhaseId)
    }

    async setPhaseBatches(
        campaignPhaseId: string,
        batches: MealBatch[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.PHASE,
            campaignPhaseId,
            batches,
            this.TTL.PHASE_BATCHES,
        )
    }

    async deletePhaseBatches(campaignPhaseId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.PHASE, campaignPhaseId)
    }

    // ==================== Campaign Batches ====================

    async getCampaignBatches(campaignId: string): Promise<MealBatch[] | null> {
        return this.getRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    async setCampaignBatches(
        campaignId: string,
        batches: MealBatch[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.CAMPAIGN,
            campaignId,
            batches,
            this.TTL.CAMPAIGN_BATCHES,
        )
    }

    async deleteCampaignBatches(campaignId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.CAMPAIGN, campaignId)
    }

    async deleteAllCampaignBatches(): Promise<void> {
        return this.deleteAllLists(this.KEYS.CAMPAIGN)
    }

    // ==================== Kitchen Staff Batches ====================

    async getUserBatches(kitchenStaffId: string): Promise<MealBatch[] | null> {
        return this.getRelatedList(this.KEYS.USER, kitchenStaffId)
    }

    async setUserBatches(
        kitchenStaffId: string,
        batches: MealBatch[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.USER,
            kitchenStaffId,
            batches,
            this.TTL.USER_BATCHES,
        )
    }

    async deleteUserBatches(kitchenStaffId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.USER, kitchenStaffId)
    }

    // ==================== Statistics ====================

    async getPhaseStats(campaignPhaseId: string): Promise<{
        totalBatches: number
        preparingCount: number
        readyCount: number
        deliveredCount: number
        totalPortions: number
    } | null> {
        return this.getStats(this.KEYS.STATS, `phase:${campaignPhaseId}`)
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
        return this.setStats(
            this.KEYS.STATS,
            stats,
            this.TTL.STATS,
            `phase:${campaignPhaseId}`,
        )
    }

    async deletePhaseStats(campaignPhaseId: string): Promise<void> {
        return this.deleteStats(this.KEYS.STATS, `phase:${campaignPhaseId}`)
    }

    // ==================== Invalidation ====================

    async invalidateBatch(
        batchId: string,
        campaignPhaseId?: string,
        kitchenStaffId?: string,
    ): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteBatch(batchId),
            this.deleteAllBatchLists(),
        ]

        if (campaignPhaseId) {
            operations.push(
                this.deletePhaseBatches(campaignPhaseId),
                this.deletePhaseStats(campaignPhaseId),
            )
        }

        if (kitchenStaffId) {
            operations.push(this.deleteUserBatches(kitchenStaffId))
        }

        return this.invalidateMultiple(...operations)
    }

    async invalidateAll(): Promise<void> {
        return this.invalidateByPatterns(
            `${this.KEYS.SINGLE}:*`,
            `${this.KEYS.LIST}:*`,
            `${this.KEYS.PHASE}:*`,
            `${this.KEYS.CAMPAIGN}:*`,
            `${this.KEYS.USER}:*`,
            `${this.KEYS.STATS}:*`,
        )
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("meal-batch*")
    }
}
