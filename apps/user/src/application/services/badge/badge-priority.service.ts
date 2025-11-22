import { Injectable } from "@nestjs/common"

/**
 * Badge Priority Service
 * Quản lý thứ tự ưu tiên của badges để tự động upgrade
 * User chỉ giữ badge cao nhất (highest priority)
 */

export enum BadgePriority {
    // Donation Amount Badges (Highest Priority)
    DIAMOND_DONOR = 100,
    GOLD_DONOR = 90,
    SILVER_DONOR = 80,
    BRONZE_DONOR = 70,

    // Campaign Support Badges
    CAMPAIGN_CHAMPION = 60,
    CAMPAIGN_SUPPORTER = 50,

    // Loyalty Badges
    LOYAL_DONOR = 40,
    MONTHLY_DONOR = 30,

    // Special Badges
    TOP_DONOR = 25,
    EARLY_SUPPORTER = 20,
    COMMUNITY_HERO = 15,

    // Entry Badge (Lowest Priority)
    FIRST_DONATION = 10,
}

export interface BadgeConfig {
    id: string
    name: string
    priority: BadgePriority
    description: string
}

@Injectable()
export class BadgePriorityService {
    // Badge configuration với priority
    private readonly badgeConfigs: Map<string, BadgeConfig> = new Map()

    /**
     * Register badge với priority
     */
    registerBadge(config: BadgeConfig): void {
        this.badgeConfigs.set(config.name, config)
    }

    /**
     * So sánh 2 badges, return badge có priority cao hơn
     */
    getHigherPriorityBadge(badge1Name: string, badge2Name: string): string {
        const config1 = this.badgeConfigs.get(badge1Name)
        const config2 = this.badgeConfigs.get(badge2Name)

        if (!config1) return badge2Name
        if (!config2) return badge1Name

        return config1.priority > config2.priority ? badge1Name : badge2Name
    }

    /**
     * Check nếu badge mới có priority cao hơn badge hiện tại
     */
    shouldReplaceBadge(
        currentBadgeName: string | null,
        newBadgeName: string,
    ): boolean {
        if (!currentBadgeName) return true

        const currentConfig = this.badgeConfigs.get(currentBadgeName)
        const newConfig = this.badgeConfigs.get(newBadgeName)

        if (!currentConfig) return true
        if (!newConfig) return false

        return newConfig.priority > currentConfig.priority
    }

    /**
     * Get badge priority
     */
    getBadgePriority(badgeName: string): number {
        const config = this.badgeConfigs.get(badgeName)
        return config?.priority || 0
    }
}
