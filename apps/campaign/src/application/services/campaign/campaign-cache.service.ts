import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { createHash } from "crypto"
import { CampaignFilterInput, CampaignSortOrder } from "../../dtos/campaign/request"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"

export interface CampaignListCacheKey {
    filter?: CampaignFilterInput
    search?: string
    sortBy: CampaignSortOrder
    limit: number
    offset: number
}

@Injectable()
export class CampaignCacheService {
    private readonly TTL = {
        SINGLE_CAMPAIGN: 60 * 60,
        CAMPAIGN_LIST: 60 * 15,
        USER_CAMPAIGNS: 60 * 30,
        CATEGORY_CAMPAIGNS: 60 * 30,
        CAMPAIGN_STATS: 60 * 10,
        ACTIVE_CAMPAIGNS: 60 * 5,
        PLATFORM_STATS: 600,
        TRENDING_24H: 300,
        TRENDING_7D: 300,
        CATEGORY_STATS: 900,
        USER_STATS: 600,
    }

    private readonly KEYS = {
        SINGLE: "campaign",
        LIST: "campaigns:list",
        USER: "campaigns:user",
        CATEGORY: "campaigns:category",
        STATS: "campaigns:stats",
        ACTIVE: "campaigns:active",
    }

    constructor(private readonly redis: RedisService) {}

    async getCampaign(id: string): Promise<Campaign | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const key = `${this.KEYS.SINGLE}:${id}`
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as Campaign
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setCampaign(id: string, campaign: Campaign): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }
        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.set(key, JSON.stringify(campaign), {
            ex: this.TTL.SINGLE_CAMPAIGN,
        })
    }

    async deleteCampaign(id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }
        const key = `${this.KEYS.SINGLE}:${id}`
        await this.redis.del(key)
    }

    private generateListCacheKey(params: CampaignListCacheKey): string {
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

    async getCampaignList(
        params: CampaignListCacheKey,
    ): Promise<Campaign[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const key = this.generateListCacheKey(params)
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as Campaign[]
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setCampaignList(
        params: CampaignListCacheKey,
        campaigns: Campaign[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(params)
        await this.redis.set(key, JSON.stringify(campaigns), {
            ex: this.TTL.CAMPAIGN_LIST,
        })
    }

    async deleteAllCampaignLists(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${this.KEYS.LIST}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    async getUserCampaigns(userId: string): Promise<Campaign[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const key = `${this.KEYS.USER}:${userId}`
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as Campaign[]
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setUserCampaigns(
        userId: string,
        campaigns: Campaign[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${userId}`
        await this.redis.set(key, JSON.stringify(campaigns), {
            ex: this.TTL.USER_CAMPAIGNS,
        })
    }

    async deleteUserCampaigns(userId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${this.KEYS.USER}:${userId}`
        await this.redis.del(key)
    }

    async getCategoryCampaigns(categoryId: string): Promise<Campaign[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const key = `${this.KEYS.CATEGORY}:${categoryId}`
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as Campaign[]
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setCategoryCampaigns(
        categoryId: string,
        campaigns: Campaign[],
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }
        const key = `${this.KEYS.CATEGORY}:${categoryId}`
        await this.redis.set(key, JSON.stringify(campaigns), {
            ex: this.TTL.CATEGORY_CAMPAIGNS,
        })
    }

    async deleteCategoryCampaigns(categoryId: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }
        const key = `${this.KEYS.CATEGORY}:${categoryId}`
        await this.redis.del(key)
    }

    async getActiveCampaigns(): Promise<Campaign[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const key = this.KEYS.ACTIVE
            const cached = await this.redis.get(key)

            if (cached) {
                return JSON.parse(cached) as Campaign[]
            }

            return null
        } catch (error) {
            return null
        }
    }

    async setActiveCampaigns(campaigns: Campaign[]): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.KEYS.ACTIVE
        await this.redis.set(key, JSON.stringify(campaigns), {
            ex: this.TTL.ACTIVE_CAMPAIGNS,
        })
    }

    async deleteActiveCampaigns(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.KEYS.ACTIVE
        await this.redis.del(key)
    }

    async invalidateAll(
        campaignId?: string,
        userId?: string,
        categoryId?: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const deleteOperations: Promise<void>[] = [
            this.deleteAllCampaignLists(),
            this.deleteActiveCampaigns(),
        ]

        if (campaignId) {
            deleteOperations.push(this.deleteCampaign(campaignId))
        }

        if (userId) {
            deleteOperations.push(this.deleteUserCampaigns(userId))
        }

        if (categoryId) {
            deleteOperations.push(this.deleteCategoryCampaigns(categoryId))
        }

        await Promise.all(deleteOperations)
    }

    async warmUpCache(campaigns: Campaign[]): Promise<void> {
        if (!this.redis.isAvailable() || campaigns.length === 0) {
            return
        }

        const operations: Promise<void>[] = campaigns.map((campaign) =>
            this.setCampaign(campaign.id, campaign),
        )

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

            const keys = await this.redis.keys("campaign*")
            const keysCount = keys.length

            return { available: true, keysCount }
        } catch (error) {
            return { available: false, keysCount: 0 }
        }
    }

    async setPlatformStats(filter: string, stats: any): Promise<void> {
        const key = this.buildPlatformStatsKey(filter)
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.PLATFORM_STATS,
        })
    }

    async getPlatformStats(filter: string): Promise<any | null> {
        const key = this.buildPlatformStatsKey(filter)
        const cached = await this.redis.get(key)
        if (cached) {
            return JSON.parse(cached)
        }
        return null
    }

    async setTrendingCampaigns(
        period: "24h" | "7d",
        campaigns: any[],
    ): Promise<void> {
        const key = this.buildTrendingKey(period)
        const ttl =
            period === "24h" ? this.TTL.TRENDING_24H : this.TTL.TRENDING_7D
        await this.redis.set(key, JSON.stringify(campaigns), { ex: ttl })
    }

    async getTrendingCampaigns(period: "24h" | "7d"): Promise<any[] | null> {
        const key = this.buildTrendingKey(period)
        const cached = await this.redis.get(key)
        if (cached) {
            return JSON.parse(cached)
        }
        return null
    }

    async setCategoryStats(categoryId: string, stats: any): Promise<void> {
        const key = this.buildCategoryStatsKey(categoryId)
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.CATEGORY_STATS,
        })
    }

    async getCategoryStats(categoryId: string): Promise<any | null> {
        const key = this.buildCategoryStatsKey(categoryId)
        const cached = await this.redis.get(key)
        if (cached) {
            return JSON.parse(cached)
        }
        return null
    }

    async setUserCampaignStats(userId: string, stats: any): Promise<void> {
        const key = this.buildUserStatsKey(userId)
        await this.redis.set(key, JSON.stringify(stats), {
            ex: this.TTL.USER_STATS,
        })
    }

    async getUserCampaignStats(userId: string): Promise<any | null> {
        const key = this.buildUserStatsKey(userId)
        const cached = await this.redis.get(key)
        if (cached) {
            return JSON.parse(cached)
        }
        return null
    }

    async invalidateAllStats(): Promise<void> {
        const patterns = [
            "campaign:stats:platform:*",
            "campaign:stats:trending:*",
            "campaign:stats:category:*",
            "campaign:stats:user:*",
        ]

        for (const pattern of patterns) {
            await this.redis.del(pattern)
        }
    }

    async invalidateUserStats(userId: string): Promise<void> {
        const key = this.buildUserStatsKey(userId)
        await this.redis.del(key)
    }

    async invalidateCategoryStats(categoryId: string): Promise<void> {
        const key = this.buildCategoryStatsKey(categoryId)
        await this.redis.del(key)
    }

    private buildPlatformStatsKey(filter: string): string {
        return `campaign:stats:platform:${filter}`
    }

    private buildTrendingKey(period: "24h" | "7d"): string {
        return `campaign:stats:trending:${period}`
    }

    private buildCategoryStatsKey(categoryId: string): string {
        return `campaign:stats:category:${categoryId}`
    }

    private buildUserStatsKey(userId: string): string {
        return `campaign:stats:user:${userId}`
    }
}