import { RedisService } from "@libs/redis"
import { DonorRepository } from "../../repositories/donor.repository"
import { Injectable } from "@nestjs/common"

@Injectable()
export class CampaignFollowerService {
    private readonly CACHE_TTL = 3600 // 1 hour

    constructor(
        private readonly donorRepository: DonorRepository,
        private readonly redis: RedisService,
    ) {}

    async getCampaignFollowers(campaignId: string): Promise<string[]> {
        const cacheKey = `campaign:followers:${campaignId}`
        const cached = await this.redis.get(cacheKey)

        if (cached) {
            return JSON.parse(cached) as string[]
        }

        const followers = await this.donorRepository.getCampaignFollowers(campaignId)

        await this.redis.setex(
            cacheKey,
            this.CACHE_TTL,
            JSON.stringify(followers),
        )

        return followers
    }

    async invalidateFollowersCache(campaignId: string): Promise<void> {
        const cacheKey = `campaign:followers:${campaignId}`
        await this.redis.del(cacheKey)
    }
}