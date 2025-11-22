import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { v7 as uuidv7 } from "uuid"

@Injectable()
export class UserBadgeRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async awardBadge(userId: string, badgeId: string) {
        return this.prisma.user_Badge.create({
            data: {
                id: uuidv7(),
                user_id: userId,
                badge_id: badgeId,
            },
            include: {
                badge: true,
                user: true,
            },
        })
    }

    async findUserBadge(userId: string) {
        return this.prisma.user_Badge.findUnique({
            where: { user_id: userId },
            include: {
                badge: true,
            },
        })
    }

    async updateBadge(userId: string, badgeId: string) {
        return this.prisma.user_Badge.update({
            where: { user_id: userId },
            data: {
                badge_id: badgeId,
                awarded_at: new Date(), // Update timestamp when badge changes
            },
            include: {
                badge: true,
                user: true,
            },
        })
    }

    async revokeBadge(userId: string) {
        return this.prisma.user_Badge.delete({
            where: { user_id: userId },
            include: {
                badge: true,
                user: true,
            },
        })
    }

    async findBadgeUsers(badgeId: string) {
        return this.prisma.user_Badge.findMany({
            where: { badge_id: badgeId },
            include: {
                user: true,
            },
        })
    }

    async countBadgeUsers(badgeId: string) {
        return this.prisma.user_Badge.count({
            where: { badge_id: badgeId },
        })
    }

    // DataLoader optimized method
    async findBadgesByUserIds(userIds: string[]) {
        const userBadges = await this.prisma.user_Badge.findMany({
            where: {
                user_id: { in: userIds },
            },
            include: {
                badge: true,
            },
        })

        // Create map for O(1) lookup
        const badgeMap = new Map<string, any>()
        userBadges.forEach((ub) => {
            badgeMap.set(ub.user_id, ub.badge)
        })

        // Return in same order as input, null if no badge
        return userIds.map((id) => badgeMap.get(id) || null)
    }
}
