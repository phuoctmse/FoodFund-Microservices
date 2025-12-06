import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from "@nestjs/common"
import { RedisService } from "@libs/redis"
import { BadgeRepository } from "../../repositories"
import { CreateBadgeInput, UpdateBadgeInput } from "../../dtos/badge.input"

@Injectable()
export class BadgeService {
    private readonly logger = new Logger(BadgeService.name)
    private readonly CACHE_KEY = "badges:all"
    private readonly CACHE_TTL = 86400

    constructor(
        private readonly badgeRepository: BadgeRepository,
        private readonly redis: RedisService,
    ) { }

    async createBadge(data: CreateBadgeInput) {
        if (data.sort_order !== undefined) {
            const existingBadge =
                await this.badgeRepository.findBadgeBySortOrder(
                    data.sort_order,
                )
            if (existingBadge) {
                throw new BadRequestException(
                    `Badge with sort_order ${data.sort_order} already exists: "${existingBadge.name}". Please use a different sort_order.`,
                )
            }
        }

        this.logger.log(`Creating badge: ${data.name}`)
        const badge = await this.badgeRepository.createBadge(data)

        await this.invalidateCache()

        return badge
    }

    async getAllBadges(includeInactive = false) {
        if (!includeInactive) {
            const cached = await this.getFromCache()
            if (cached) {
                this.logger.debug("Returning badges from cache")
                return cached
            }
        }

        const badges = await this.badgeRepository.findAllBadges(includeInactive)

        // Cache only active badges
        if (!includeInactive) {
            await this.setCache(badges)
        }

        return badges
    }

    private async getFromCache() {
        if (!this.redis.isAvailable()) {
            return null
        }

        try {
            const cached = await this.redis.get(this.CACHE_KEY)
            if (cached) {
                return JSON.parse(cached)
            }
        } catch (error) {
            this.logger.error("Failed to get badges from cache", error)
        }

        return null
    }

    private async setCache(badges: any[]) {
        if (!this.redis.isAvailable()) {
            return
        }

        try {
            await this.redis.set(
                this.CACHE_KEY,
                JSON.stringify(badges),
                { ex: this.CACHE_TTL }
            )
            this.logger.debug("Badges cached successfully")
        } catch (error) {
            this.logger.error("Failed to cache badges", error)
        }
    }

    private async invalidateCache() {
        if (!this.redis.isAvailable()) {
            return
        }

        try {
            await this.redis.del(this.CACHE_KEY)
            this.logger.debug("Badge cache invalidated")
        } catch (error) {
            this.logger.error("Failed to invalidate badge cache", error)
        }
    }

    async getBadgeById(id: string) {
        const badge = await this.badgeRepository.findBadgeById(id)
        if (!badge) {
            throw new NotFoundException(`Badge with ID ${id} not found`)
        }
        return badge
    }

    async updateBadge(id: string, data: UpdateBadgeInput) {
        const badge = await this.badgeRepository.findBadgeById(id)
        if (!badge) {
            throw new NotFoundException(`Badge with ID ${id} not found`)
        }

        if (data.sort_order !== undefined) {
            const existingBadge =
                await this.badgeRepository.findBadgeBySortOrder(
                    data.sort_order,
                    id,
                )
            if (existingBadge) {
                throw new BadRequestException(
                    `Badge with sort_order ${data.sort_order} already exists: "${existingBadge.name}". Please use a different sort_order.`,
                )
            }
        }

        this.logger.log(`Updating badge: ${id}`)
        const updatedBadge = await this.badgeRepository.updateBadge(id, data)

        await this.invalidateCache()

        return updatedBadge
    }

    async deleteBadge(id: string) {
        const badge = await this.badgeRepository.findBadgeById(id)
        if (!badge) {
            throw new NotFoundException(`Badge with ID ${id} not found`)
        }

        const userCount = await this.badgeRepository.countBadges()
        if (userCount > 0) {
            throw new BadRequestException(
                `Cannot delete badge. It is currently assigned to ${userCount} user(s)`,
            )
        }

        this.logger.log(`Deleting badge: ${id}`)
        const result = await this.badgeRepository.deleteBadge(id)

        await this.invalidateCache()

        return result
    }

}
