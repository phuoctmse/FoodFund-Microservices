import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from "@nestjs/common"
import { UserBadgeRepository, BadgeRepository } from "../../repositories"
import { UserRepository } from "../../repositories/user.repository"
import { Role } from "../../../domain/enums"
import { BadgeEmailService } from "./badge-email.service"

@Injectable()
export class UserBadgeService {
    private readonly logger = new Logger(UserBadgeService.name)

    constructor(
        private readonly userBadgeRepository: UserBadgeRepository,
        private readonly badgeRepository: BadgeRepository,
        private readonly badgeEmailService: BadgeEmailService,
    ) {}

    async awardBadge(userId: string, badgeId: string) {
        // Validate badge exists and is active
        const badge = await this.badgeRepository.findBadgeById(badgeId)
        if (!badge) {
            throw new NotFoundException(`Badge with ID ${badgeId} not found`)
        }

        if (!badge.is_active) {
            throw new BadRequestException(
                `Badge "${badge.name}" is currently inactive and cannot be awarded`,
            )
        }

        // Check if user already has a badge
        const existingBadge =
            await this.userBadgeRepository.findUserBadge(userId)

        if (existingBadge) {
            if (existingBadge.badge_id === badgeId) {
                this.logger.log(
                    `User ${userId} already has badge ${badge.name}, skipping`,
                )
                return existingBadge
            }

            this.logger.log(
                `Upgrading user ${userId} badge from ${existingBadge.badge.name} to ${badge.name}`,
            )
            const userBadge = await this.userBadgeRepository.updateBadge(userId, badgeId)
            
            // Send email notification (non-blocking)
            if (userBadge.user) {
                this.sendBadgeEmailAsync(userBadge.user, badge)
            }
            
            return userBadge
        }

        // First badge - CREATE
        this.logger.log(`Awarding first badge ${badge.name} to user ${userId}`)
        const userBadge = await this.userBadgeRepository.awardBadge(userId, badgeId)
        
        // Send email notification (non-blocking)
        if (userBadge.user) {
            this.sendBadgeEmailAsync(userBadge.user, badge)
        }
        
        return userBadge
    }

    /**
     * Send badge award email asynchronously (non-blocking)
     */
    private async sendBadgeEmailAsync(user: any, badge: any): Promise<void> {
        try {
            // Format total donated amount
            const totalDonated = user.total_donated
                ? `${Number(user.total_donated).toLocaleString("vi-VN")} VNĐ`
                : "0 VNĐ"

            await this.badgeEmailService.sendBadgeAwardEmail({
                userEmail: user.email,
                userName: user.full_name || user.user_name,
                badgeName: badge.name,
                badgeDescription: badge.description,
                badgeIconUrl: badge.icon_url,
                totalDonated,
                donationCount: user.donation_count || 0,
            })
        } catch (error) {
            // Non-blocking: Just log error, don't throw
            this.logger.error(
                `Failed to send badge email to user ${user.id}:`,
                error.message,
            )
        }
    }

    async getUserBadge(userId: string) {
        return this.userBadgeRepository.findUserBadge(userId)
    }

    async revokeBadge(userId: string) {
        const userBadge = await this.userBadgeRepository.findUserBadge(userId)
        if (!userBadge) {
            throw new NotFoundException(
                `User with ID ${userId} does not have a badge`,
            )
        }

        this.logger.log(`Revoking badge from user ${userId}`)
        return this.userBadgeRepository.revokeBadge(userId)
    }

    async getBadgeUsers(badgeId: string) {
        const badge = await this.badgeRepository.findBadgeById(badgeId)
        if (!badge) {
            throw new NotFoundException(`Badge with ID ${badgeId} not found`)
        }

        return this.userBadgeRepository.findBadgeUsers(badgeId)
    }
}
