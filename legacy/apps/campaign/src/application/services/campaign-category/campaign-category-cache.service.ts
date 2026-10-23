import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { BaseCacheService } from "@app/campaign/src/shared/services"
import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"

@Injectable()
export class CampaignCategoryCacheService extends BaseCacheService<CampaignCategory> {
    protected readonly TTL = {
        CATEGORY_STATS: 60 * 15, // 15 minutes
    }

    protected readonly KEYS = {
        STATS: "categories:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Category Stats ====================

    async getCategoryStats(): Promise<Array<
        CampaignCategory & { campaignCount: number }
    > | null> {
        return this.getStats<Array<CampaignCategory & { campaignCount: number }>>(
            this.KEYS.STATS,
        )
    }

    async setCategoryStats(
        stats: Array<CampaignCategory & { campaignCount: number }>,
    ): Promise<void> {
        return this.setStats(this.KEYS.STATS, stats, this.TTL.CATEGORY_STATS)
    }

    async deleteCategoryStats(): Promise<void> {
        return this.deleteStats(this.KEYS.STATS)
    }

    // ==================== Invalidation ====================

    async invalidateAll(): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteCategoryStats(),
        ]

        return this.invalidateMultiple(...operations)
    }

    // ==================== Cache Warming ====================

    async warmUpCache(
        stats?: Array<CampaignCategory & { campaignCount: number }>,
    ): Promise<void> {
        const operations: Promise<void>[] = []

        if (stats) {
            operations.push(this.setCategoryStats(stats))
        }

        await Promise.all(operations)
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("category*")
    }
}