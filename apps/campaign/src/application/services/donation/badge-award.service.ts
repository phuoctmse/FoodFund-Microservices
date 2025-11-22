import { Injectable, Logger } from "@nestjs/common"
import { GrpcClientService } from "@libs/grpc"
import { envConfig } from "@libs/env"

/**
 * Badge Award Service - MVP Version
 * Auto-award badges based on total donation amount
 * Badges auto-upgrade when user reaches higher milestones
 */

interface BadgeMilestone {
    name: string
    badgeId: string
    minAmount: bigint
    priority: number
}

@Injectable()
export class BadgeAwardService {
    private readonly logger = new Logger(BadgeAwardService.name)
    env = envConfig()

    private readonly milestones: BadgeMilestone[] = [
        {
            name: "Diamond Star",
            badgeId: this.env.badge.diamondId,
            minAmount: BigInt(500_000_000), // 500M VND
            priority: 110,
        },
        {
            name: "Platinum Star",
            badgeId: this.env.badge.platinumId,
            minAmount: BigInt(100_000_000), // 100M VND
            priority: 100,
        },
        {
            name: "Gold Star",
            badgeId: this.env.badge.goldId,
            minAmount: BigInt(10_000_000), // 10M VND
            priority: 90,
        },
        {
            name: "Silver Star",
            badgeId: this.env.badge.silverId,
            minAmount: BigInt(1_000_000), // 1M VND
            priority: 80,
        },
        {
            name: "Bronze Star",
            badgeId: this.env.badge.bronzeId,
            minAmount: BigInt(100_000), // 100K VND
            priority: 70,
        },
        {
            name: "First Donation",
            badgeId: this.env.badge.firstDonationId,
            minAmount: BigInt(0), // Any amount
            priority: 10,
        },
    ]

    constructor(private readonly grpcClient: GrpcClientService) {}

    async checkAndAwardBadge(donorId: string): Promise<void> {
        try {
            // Step 1: Get user with cached stats from User DB via gRPC
            const userResponse = await this.grpcClient.callUserService<
                { id: string },
                {
                    success: boolean
                    id?: string
                    totalDonated?: string 
                    donationCount?: number
                    lastDonationAt?: string
                    error?: string
                }
            >("GetUserWithStats", { id: donorId })

            if (!userResponse.success || !userResponse.id) {
                this.logger.error(
                    `[BadgeAward] User not found: ${donorId}`,
                )
                return
            }

            // Step 2: Parse cached stats
            const totalDonated = userResponse.totalDonated 
                ? BigInt(userResponse.totalDonated) 
                : BigInt(0)
            const donationCount = userResponse.donationCount || 0

            this.logger.log(
                `[BadgeAward] Donor ${donorId} stats - Total: ${totalDonated}, Count: ${donationCount}`,
            )

            // Step 3: Find appropriate milestone
            const milestone = this.findHighestMilestone(totalDonated)

            if (!milestone) {
                this.logger.warn(
                    `[BadgeAward] No badge milestone found for donor ${donorId} with amount ${totalDonated}`,
                )
                return
            }

            this.logger.log(
                `[BadgeAward] Donor ${donorId} qualifies for ${milestone.name} (total: ${totalDonated})`,
            )

            // Step 4: Award badge via gRPC (will auto-replace if lower priority)
            const response = await this.grpcClient.callUserService(
                "AwardBadgeToDonor",
                {
                    userId: donorId,
                    badgeId: milestone.badgeId,
                },
            )

            if (response.success) {
                this.logger.log(
                    `✅ [BadgeAward] Awarded ${milestone.name} to donor ${donorId}`,
                )
            } else {
                this.logger.error(
                    `❌ [BadgeAward] Failed to award badge: ${response.error}`,
                )
            }
        } catch (error) {
            // Non-blocking: Log error but don't throw
            // Badge award failure should not affect donation flow
            this.logger.error(
                `[BadgeAward] Error awarding badge to donor ${donorId}:`,
                error.message,
            )
        }
    }

    /**
     * Find highest milestone that user qualifies for
     * Milestones are sorted by priority DESC, so first match is highest
     */
    private findHighestMilestone(totalAmount: bigint): BadgeMilestone | null {
        for (const milestone of this.milestones) {
            if (totalAmount >= milestone.minAmount) {
                return milestone
            }
        }
        return null
    }
}
