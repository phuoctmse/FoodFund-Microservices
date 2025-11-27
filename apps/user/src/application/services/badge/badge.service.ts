import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from "@nestjs/common"
import { BadgeRepository } from "../../repositories"
import { CreateBadgeInput, UpdateBadgeInput } from "../../dtos/badge.input"

@Injectable()
export class BadgeService {
    private readonly logger = new Logger(BadgeService.name)

    constructor(private readonly badgeRepository: BadgeRepository) { }

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
        return this.badgeRepository.createBadge(data)
    }

    async getAllBadges(includeInactive = false) {
        return this.badgeRepository.findAllBadges(includeInactive)
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
        return this.badgeRepository.updateBadge(id, data)
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
        return this.badgeRepository.deleteBadge(id)
    }

}
