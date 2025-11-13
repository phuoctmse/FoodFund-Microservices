import { CampaignCategory } from "@app/campaign/src/domain/entities/campaign-category.model"
import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"

@Injectable()
export class CampaignCategoryCacheService {
    private readonly TTL = {
        SINGLE_CATEGORY: 60 * 60,
        ALL_CATEGORIES: 60 * 30,
        CATEGORY_STATS: 60 * 15,
    }

    private readonly KEYS = {
        SINGLE: "category",
        ALL_ACTIVE: "categories:all:active",
        ALL_WITH_INACTIVE: "categories:all:with-inactive",
        STATS: "categories:stats",
    }

    constructor(private readonly redis: RedisService) {}

    async getCategory(id: string): Promise<CampaignCategory | null> {
        try {
            const key = `${this.KEYS.SINGLE}:${id}`
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as CampaignCategory
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setCategory(id: string, category: CampaignCategory): Promise<void> {
        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(category), {
            ex: this.TTL.SINGLE_CATEGORY,
        })
    }

    async deleteCategory(id: string): Promise<void> {
        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    async getAllActiveCategories(): Promise<CampaignCategory[] | null> {
        try {
            const cached = await this.redis.get(this.KEYS.ALL_ACTIVE)

            if (cached) {
                return JSON.parse(cached) as CampaignCategory[]
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setAllActiveCategories(
        categories: CampaignCategory[],
    ): Promise<void> {
        await this.redis.set(this.KEYS.ALL_ACTIVE, JSON.stringify(categories), {
            ex: this.TTL.ALL_CATEGORIES,
        })
    }

    async deleteAllActiveCategories(): Promise<void> {
        await this.redis.del(this.KEYS.ALL_ACTIVE)
    }

    async getCategoryStats(): Promise<Array<
        CampaignCategory & { campaignCount: number }
    > | null> {
        try {
            const cached = await this.redis.get(this.KEYS.STATS)

            if (cached) {
                return JSON.parse(cached) as Array<
                    CampaignCategory & { campaignCount: number }
                >
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setCategoryStats(
        stats: Array<CampaignCategory & { campaignCount: number }>,
    ): Promise<void> {
        await this.redis.set(this.KEYS.STATS, JSON.stringify(stats), {
            ex: this.TTL.CATEGORY_STATS,
        })
    }

    async deleteCategoryStats(): Promise<void> {
        await this.redis.del(this.KEYS.STATS)
    }

    async invalidateAll(categoryId?: string): Promise<void> {
        const deleteOperations: Promise<void>[] = [
            this.deleteAllActiveCategories(),
            this.deleteCategoryStats(),
        ]

        if (categoryId) {
            deleteOperations.push(this.deleteCategory(categoryId))
        }

        await Promise.all(deleteOperations)
    }

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

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        try {
            const isAvailable = this.redis.isAvailable()

            if (!isAvailable) {
                return { available: false, keysCount: 0 }
            }

            const keys = await this.redis.keys("category*")
            const keysCount = keys.length

            return { available: true, keysCount }
        } catch (error) {
            return { available: false, keysCount: 0 }
        }
    }
}
