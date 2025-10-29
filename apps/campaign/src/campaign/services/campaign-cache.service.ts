import { Injectable } from "@nestjs/common"
import { CampaignFilterInput, CampaignSortOrder } from "../dtos"
import { RedisService } from "@libs/redis"
import { Campaign } from "../models"
import { createHash } from "crypto"

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
}
