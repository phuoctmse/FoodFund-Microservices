import { Injectable } from "@nestjs/common"
import { Donation, Prisma, PrismaClient } from "../../generated/campaign-client"
import { CreateDonationRepositoryInput } from "../dtos/create-donation-repository.input"

@Injectable()
export class DonationRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateDonationRepositoryInput): Promise<Donation> {
        return this.prisma.donation.create({
            data: {
                donor_id: data.donor_id,
                campaign: {
                    connect: { id: data.campaign_id }
                },
                amount: data.amount,
                message: data.message,
                is_anonymous: data.is_anonymous,
            },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    async createWithId(id: string, data: CreateDonationRepositoryInput): Promise<Donation> {
        return this.prisma.donation.create({
            data: {
                id,
                donor_id: data.donor_id,
                campaign: {
                    connect: { id: data.campaign_id }
                },
                amount: data.amount,
                message: data.message,
                is_anonymous: data.is_anonymous,
            },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    async findById(id: string): Promise<Donation | null> {
        return this.prisma.donation.findUnique({
            where: { id },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }

    async findByDonorId(
        donorId: string,
        options?: {
            skip?: number
            take?: number
            orderBy?: Prisma.DonationOrderByWithRelationInput
        }
    ): Promise<Donation[]> {
        return this.prisma.donation.findMany({
            where: { donor_id: donorId },
            include: {
                campaign: true,
                payment_transactions: true,
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: options?.orderBy ?? { created_at: "desc" },
        })
    }

    async findByCampaignId(
        campaignId: string,
        options?: {
            skip?: number
            take?: number
            orderBy?: Prisma.DonationOrderByWithRelationInput
        }
    ): Promise<Donation[]> {
        return this.prisma.donation.findMany({
            where: { campaign_id: campaignId },
            include: {
                campaign: true,
                payment_transactions: true,
            },
            skip: options?.skip,
            take: options?.take,
            orderBy: options?.orderBy ?? { created_at: "desc" },
        })
    }

    async getTotalDonationsByCampaign(campaignId: string): Promise<{
        totalAmount: bigint
        donationCount: number
    }> {
        const result = await this.prisma.donation.aggregate({
            where: { campaign_id: campaignId },
            _sum: { amount: true },
            _count: { id: true },
        })

        return {
            totalAmount: result._sum.amount || BigInt(0),
            donationCount: result._count.id || 0,
        }
    }

    async getDonationStats(donorId: string): Promise<{
        totalDonated: bigint
        donationCount: number
        campaignCount: number
    }> {
        const [donations, campaignCount] = await Promise.all([
            this.prisma.donation.aggregate({
                where: { donor_id: donorId },
                _sum: { amount: true },
                _count: { id: true },
            }),
            this.prisma.donation.groupBy({
                by: ["campaign_id"],
                where: { donor_id: donorId },
                _count: { campaign_id: true },
            }),
        ])

        return {
            totalDonated: donations._sum.amount || BigInt(0),
            donationCount: donations._count.id || 0,
            campaignCount: campaignCount.length,
        }
    }

    async updatePaymentReference(
        id: string,
        paymentReference: string
    ): Promise<Donation> {
        return this.prisma.donation.update({
            where: { id },
            data: { payment_reference: paymentReference },
            include: {
                campaign: true,
                payment_transactions: true,
            },
        })
    }
}