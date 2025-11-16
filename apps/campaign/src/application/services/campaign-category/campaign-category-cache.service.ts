import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { BaseCacheService } from "@app/campaign/src/shared/services"
import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"

@Injectable()
export class CampaignCategoryCacheService extends BaseCacheService<CampaignCategory> {
    protected readonly TTL = {
        SINGLE_CATEGORY: 60 * 60, // 1 hour
        ALL_CATEGORIES: 60 * 30, // 30 minutes
        CATEGORY_STATS: 60 * 15, // 15 minutes
    }

    protected readonly KEYS = {
        SINGLE: "category",
        ALL_ACTIVE: "categories:all:active",
        STATS: "categories:stats",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Category ====================

    async getCategory(id: string): Promise<CampaignCategory | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setCategory(id: string, category: CampaignCategory): Promise<void> {
        return this.setSingle(
            this.KEYS.SINGLE,
            id,
            category,
            this.TTL.SINGLE_CATEGORY,
        )
    }

    async deleteCategory(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== All Active Categories ====================

    async getAllActiveCategories(): Promise<CampaignCategory[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const cached = await this.redis.get(this.KEYS.ALL_ACTIVE)

        if (cached) {
            return JSON.parse(cached) as CampaignCategory[]
        }

        return null
    }

    async setAllActiveCategories(
        categories: CampaignCategory[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        await this.redis.set(this.KEYS.ALL_ACTIVE, JSON.stringify(categories), {
            ex: this.TTL.ALL_CATEGORIES,
        })
    }

    async deleteAllActiveCategories(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        await this.redis.del(this.KEYS.ALL_ACTIVE)
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

    async invalidateAll(categoryId?: string): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteAllActiveCategories(),
            this.deleteCategoryStats(),
        ]

        if (categoryId) {
            operations.push(this.deleteCategory(categoryId))
        }

        return this.invalidateMultiple(...operations)
    }

    // ==================== Cache Warming ====================

    async warmUpCache(
        categories: CampaignCategory[],
        stats?: Array<CampaignCategory & { campaignCount: number }>,
    ): Promise<void> {
        const operations: Promise<void>[] = [
            this.setAllActiveCategories(categories.filter((c) => c.isActive)),
        ]

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