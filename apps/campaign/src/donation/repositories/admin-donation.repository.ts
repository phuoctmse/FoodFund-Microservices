import { Injectable } from "@nestjs/common"
import { BaseDonationRepository } from "./base-donation.repository"
import { PaymentStatus } from "../../shared/enum/campaign.enum"

/**
 * Repository for admin donation operations
 */
@Injectable()
export class AdminDonationRepository extends BaseDonationRepository {
    /**
     * Admin manually approve a FAILED payment
     * Updates status to SUCCESS and increments campaign stats
     */
    async manualApprovePayment(
        paymentId: string,
        campaignId: string,
        amount: bigint,
        adminNote: string,
    ) {
        return this.prisma.$transaction(async (tx) => {
            // Update payment status
            const payment = await tx.payment_Transaction.update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.SUCCESS,
                    error_description: adminNote,
                    updated_at: new Date(),
                },
            })

            // Increment campaign stats
            await tx.campaign.update({
                where: { id: campaignId },
                data: {
                    received_amount: {
                        increment: amount,
                    },
                    donation_count: {
                        increment: 1,
                    },
                },
            })

            return payment
        })
    }

    /**
     * Find FAILED payments for admin review
     */
    async findFailedPayments(options?: { skip?: number; take?: number }) {
        return this.prisma.payment_Transaction.findMany({
            where: {
                status: PaymentStatus.FAILED,
            },
            include: {
                donation: {
                    include: {
                        campaign: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            skip: options?.skip,
            take: options?.take,
        })
    }

    /**
     * Find all donations with filters for admin
     */
    async findAllWithFilters(options: {
        status?: string
        campaignId?: string
        startDate?: Date
        endDate?: Date
        minAmount?: bigint
        maxAmount?: bigint
        skip?: number
        take?: number
    }) {
        const where: any = {}

        // Status filter
        if (options.status && options.status !== "ALL") {
            where.payment_transactions = {
                some: {
                    status: options.status,
                },
            }
        }

        // Campaign filter
        if (options.campaignId) {
            where.campaign_id = options.campaignId
        }

        // Date range filter
        if (options.startDate || options.endDate) {
            where.created_at = {}
            if (options.startDate) {
                where.created_at.gte = options.startDate
            }
            if (options.endDate) {
                where.created_at.lte = options.endDate
            }
        }

        // Amount range filter
        if (options.minAmount || options.maxAmount) {
            where.amount = {}
            if (options.minAmount) {
                where.amount.gte = options.minAmount
            }
            if (options.maxAmount) {
                where.amount.lte = options.maxAmount
            }
        }

        const [donations, totalCount] = await Promise.all([
            this.prisma.donation.findMany({
                where,
                include: {
                    campaign: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    payment_transactions: true,
                },
                orderBy: {
                    created_at: "desc",
                },
                skip: options.skip,
                take: options.take,
            }),
            this.prisma.donation.count({ where }),
        ])

        return { donations, totalCount }
    }

    /**
     * Get donation statistics for dashboard
     */
    async getDonationStatistics() {
        const [
            totalStats,
            statusCounts,
            uniqueDonors,
            campaignsWithDonations,
        ] = await Promise.all([
            // Total amount and count
            this.prisma.donation.aggregate({
                _sum: { amount: true },
                _count: { id: true },
            }),
            // Count by status
            this.prisma.payment_Transaction.groupBy({
                by: ["status"],
                _count: { id: true },
            }),
            // Unique donors
            this.prisma.donation.findMany({
                select: { donor_id: true },
                distinct: ["donor_id"],
            }),
            // Campaigns with donations
            this.prisma.donation.findMany({
                select: { campaign_id: true },
                distinct: ["campaign_id"],
            }),
        ])

        return {
            totalAmount: totalStats._sum.amount || BigInt(0),
            totalDonations: totalStats._count.id || 0,
            statusCounts,
            uniqueDonors: uniqueDonors.length,
            campaignsWithDonations: campaignsWithDonations.length,
        }
    }

    /**
     * Get top campaigns by donation amount
     */
    async getTopCampaigns(limit: number = 5) {
        const result = await this.prisma.donation.groupBy({
            by: ["campaign_id"],
            _sum: { amount: true },
            _count: { id: true },
            orderBy: {
                _sum: {
                    amount: "desc",
                },
            },
            take: limit,
        })

        // Get campaign details
        const campaignIds = result.map((r) => r.campaign_id)
        const campaigns = await this.prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true },
        })

        const campaignMap = new Map(campaigns.map((c) => [c.id, c]))

        return result.map((r) => ({
            campaignId: r.campaign_id,
            campaignTitle: campaignMap.get(r.campaign_id)?.title || "Unknown",
            totalAmount: r._sum.amount || BigInt(0),
            donationCount: r._count.id,
        }))
    }

    /**
     * Get top donors by donation amount
     */
    async getTopDonors(limit: number = 5) {
        return this.prisma.donation.groupBy({
            by: ["donor_id", "donor_name"],
            _sum: { amount: true },
            _count: { id: true },
            where: {
                payment_transactions: {
                    some: {
                        status: PaymentStatus.SUCCESS,
                    },
                },
            },
            orderBy: {
                _sum: {
                    amount: "desc",
                },
            },
            take: limit,
        })
    }
}
