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
        PLATFORM_STATS: 60 * 10, // 10 minutes
        CATEGORY_STATS: 60 * 15, // 15 minutes
        USER_STATS: 60 * 10, // 10 minutes
    }

    protected readonly KEYS = {
        SINGLE: "campaign",
        SLUG: "campaign:slug",
        LIST: "campaigns:list",
        PLATFORM_STATS: "campaigns:stats:platform",
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

    // ==================== Invalidation ====================

    async invalidateAll(campaignId?: string, slug?: string): Promise<void> {
        const operations: Promise<void>[] = [this.deleteAllCampaignLists()]

        if (campaignId) {
            operations.push(this.deleteCampaign(campaignId))
        }

        if (slug) {
            operations.push(this.deleteCampaignBySlug(slug))
        }

        return this.invalidateMultiple(...operations)
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
