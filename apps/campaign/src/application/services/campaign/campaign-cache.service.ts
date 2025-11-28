import { Injectable } from "@nestjs/common"
import { RedisService } from "@libs/redis"
import {
    CampaignFilterInput,
    CampaignSortOrder,
} from "../../dtos/campaign/request"
import { CampaignStatsResponse } from "../../dtos/campaign/response/campaign-stats.response"
import { Campaign } from "@app/campaign/src/domain/entities/campaign.model"
import { BaseCacheService } from "@app/campaign/src/shared/services"

export interface CampaignListCacheKey {
    filter?: CampaignFilterInput
    search?: string
    sortBy: CampaignSortOrder
    limit: number
    offset: number
}

@Injectable()
export class CampaignCacheService extends BaseCacheService<Campaign> {
    protected readonly TTL = {
        SINGLE_CAMPAIGN: 60 * 60, // 1 hour
        CAMPAIGN_LIST: 60 * 15, // 15 minutes
        USER_CAMPAIGNS: 60 * 30, // 30 minutes
        CATEGORY_CAMPAIGNS: 60 * 30, // 30 minutes
        ACTIVE_CAMPAIGNS: 60 * 5, // 5 minutes
        PLATFORM_STATS: 60 * 10, // 10 minutes
        TRENDING_24H: 60 * 5, // 5 minutes
        TRENDING_7D: 60 * 5, // 5 minutes
        CATEGORY_STATS: 60 * 15, // 15 minutes
        USER_STATS: 60 * 10, // 10 minutes
    }

    protected readonly KEYS = {
        SINGLE: "campaign",
        SLUG: "campaign:slug",
        LIST: "campaigns:list",
        USER: "campaigns:user",
        CATEGORY: "campaigns:category",
        ACTIVE: "campaigns:active",
        PLATFORM_STATS: "campaigns:stats:platform",
        TRENDING: "campaigns:stats:trending",
        CATEGORY_STATS: "campaigns:stats:category",
        USER_STATS: "campaigns:stats:user",
    }

    constructor(redis: RedisService) {
        super(redis)
    }

    // ==================== Single Campaign ====================

    async getCampaign(id: string): Promise<Campaign | null> {
        return this.getSingle(this.KEYS.SINGLE, id)
    }

    async setCampaign(id: string, campaign: Campaign): Promise<void> {
        return this.setSingle(
            this.KEYS.SINGLE,
            id,
            campaign,
            this.TTL.SINGLE_CAMPAIGN,
        )
    }

    async deleteCampaign(id: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SINGLE, id)
    }

    // ==================== Campaign by Slug ====================

    async getCampaignBySlug(slug: string): Promise<Campaign | null> {
        return this.getSingle(this.KEYS.SLUG, slug)
    }

    async setCampaignBySlug(slug: string, campaign: Campaign): Promise<void> {
        return this.setSingle(
            this.KEYS.SLUG,
            slug,
            campaign,
            this.TTL.SINGLE_CAMPAIGN,
        )
    }

    async deleteCampaignBySlug(slug: string): Promise<void> {
        return this.deleteSingle(this.KEYS.SLUG, slug)
    }

    // ==================== Campaign Lists ====================

    async getCampaignList(
        params: CampaignListCacheKey,
    ): Promise<Campaign[] | null> {
        return this.getList(this.KEYS.LIST, params)
    }

    async setCampaignList(
        params: CampaignListCacheKey,
        campaigns: Campaign[],
    ): Promise<void> {
        return this.setList(
            this.KEYS.LIST,
            params,
            campaigns,
            this.TTL.CAMPAIGN_LIST,
        )
    }

    async deleteAllCampaignLists(): Promise<void> {
        return this.deleteAllLists(this.KEYS.LIST)
    }

    // ==================== User Campaigns ====================

    async getUserCampaigns(userId: string): Promise<Campaign[] | null> {
        return this.getRelatedList(this.KEYS.USER, userId)
    }

    async setUserCampaigns(
        userId: string,
        campaigns: Campaign[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.USER,
            userId,
            campaigns,
            this.TTL.USER_CAMPAIGNS,
        )
    }

    async deleteUserCampaigns(userId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.USER, userId)
    }

    // ==================== Category Campaigns ====================

    async getCategoryCampaigns(categoryId: string): Promise<Campaign[] | null> {
        return this.getRelatedList(this.KEYS.CATEGORY, categoryId)
    }

    async setCategoryCampaigns(
        categoryId: string,
        campaigns: Campaign[],
    ): Promise<void> {
        return this.setRelatedList(
            this.KEYS.CATEGORY,
            categoryId,
            campaigns,
            this.TTL.CATEGORY_CAMPAIGNS,
        )
    }

    async deleteCategoryCampaigns(categoryId: string): Promise<void> {
        return this.deleteRelatedList(this.KEYS.CATEGORY, categoryId)
    }

    // ==================== Active Campaigns ====================

    async getActiveCampaigns(): Promise<Campaign[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const cached = await this.redis.get(this.KEYS.ACTIVE)

        if (cached) {
            return JSON.parse(cached) as Campaign[]
        }

        return null
    }

    async setActiveCampaigns(campaigns: Campaign[]): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        await this.redis.set(this.KEYS.ACTIVE, JSON.stringify(campaigns), {
            ex: this.TTL.ACTIVE_CAMPAIGNS,
        })
    }

    async deleteActiveCampaigns(): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        await this.redis.del(this.KEYS.ACTIVE)
    }

    // ==================== Platform Stats ====================

    async getPlatformStats(
        filter: string,
    ): Promise<CampaignStatsResponse | null> {
        return this.getStats(this.KEYS.PLATFORM_STATS, filter)
    }

    async setPlatformStats(
        filter: string,
        stats: CampaignStatsResponse,
    ): Promise<void> {
        return this.setStats(
            this.KEYS.PLATFORM_STATS,
            stats,
            this.TTL.PLATFORM_STATS,
            filter,
        )
    }

    async deletePlatformStats(filter: string): Promise<void> {
        return this.deleteStats(this.KEYS.PLATFORM_STATS, filter)
    }

    // ==================== Trending Campaigns ====================

    async getTrendingCampaigns(period: "24h" | "7d"): Promise<any[] | null> {
        return this.getStats(this.KEYS.TRENDING, period)
    }

    async setTrendingCampaigns(
        period: "24h" | "7d",
        campaigns: any[],
    ): Promise<void> {
        const ttl =
            period === "24h" ? this.TTL.TRENDING_24H : this.TTL.TRENDING_7D
        return this.setStats(this.KEYS.TRENDING, campaigns, ttl, period)
    }

    async deleteTrendingCampaigns(period: "24h" | "7d"): Promise<void> {
        return this.deleteStats(this.KEYS.TRENDING, period)
    }

    // ==================== Category Stats ====================

    async getCategoryStats(
        categoryId: string,
    ): Promise<CampaignStatsResponse | null> {
        return this.getStats(this.KEYS.CATEGORY_STATS, categoryId)
    }

    async setCategoryStats(
        categoryId: string,
        stats: CampaignStatsResponse,
    ): Promise<void> {
        return this.setStats(
            this.KEYS.CATEGORY_STATS,
            stats,
            this.TTL.CATEGORY_STATS,
            categoryId,
        )
    }

    async deleteCategoryStats(categoryId: string): Promise<void> {
        return this.deleteStats(this.KEYS.CATEGORY_STATS, categoryId)
    }

    // ==================== User Stats ====================

    async getUserCampaignStats(
        userId: string,
    ): Promise<CampaignStatsResponse | null> {
        return this.getStats(this.KEYS.USER_STATS, userId)
    }

    async setUserCampaignStats(
        userId: string,
        stats: CampaignStatsResponse,
    ): Promise<void> {
        return this.setStats(
            this.KEYS.USER_STATS,
            stats,
            this.TTL.USER_STATS,
            userId,
        )
    }

    async deleteUserCampaignStats(userId: string): Promise<void> {
        return this.deleteStats(this.KEYS.USER_STATS, userId)
    }

    // ==================== Invalidation ====================

    async invalidateAll(
        campaignId?: string,
        userId?: string,
        slug?: string,
        categoryId?: string,
    ): Promise<void> {
        const operations: Promise<void>[] = [
            this.deleteAllCampaignLists(),
            this.deleteActiveCampaigns(),
        ]

        if (campaignId) {
            operations.push(this.deleteCampaign(campaignId))
        }

        if (slug) {
            operations.push(this.deleteCampaignBySlug(slug))
        }

        if (userId) {
            operations.push(this.deleteUserCampaigns(userId))
        }

        if (categoryId) {
            operations.push(this.deleteCategoryCampaigns(categoryId))
        }

        return this.invalidateMultiple(...operations)
    }

    async invalidateAllStats(): Promise<void> {
        return this.invalidateByPatterns(
            `${this.KEYS.PLATFORM_STATS}:*`,
            `${this.KEYS.TRENDING}:*`,
            `${this.KEYS.CATEGORY_STATS}:*`,
            `${this.KEYS.USER_STATS}:*`,
        )
    }

    async invalidateUserStats(userId: string): Promise<void> {
        return this.deleteUserCampaignStats(userId)
    }

    async invalidateCategoryStats(categoryId: string): Promise<void> {
        return this.deleteCategoryStats(categoryId)
    }

    // ==================== Cache Warming ====================

    async warmUpCache(campaigns: Campaign[]): Promise<void> {
        if (campaigns.length === 0) {
            return
        }

        const operations: Promise<void>[] = campaigns.map((campaign) =>
            this.setCampaign(campaign.id, campaign),
        )

        await Promise.all(operations)
    }

    // ==================== Health Check ====================

    async getHealthStatus(): Promise<{
        available: boolean
        keysCount: number
    }> {
        return super.getHealthStatus("campaign*")
    }
}
