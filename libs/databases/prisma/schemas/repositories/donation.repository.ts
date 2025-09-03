import { Injectable } from "@nestjs/common"
import { BaseRepository } from "./base.repository"
import {
    DonationModel,
    CreateDonationInput,
    UpdateDonationInput,
    DonationWithRelations,
} from "../donation.model"

@Injectable()
export class DonationRepository extends BaseRepository<DonationModel> {
    getModelName(): string {
        return "donation"
    }

    async findByCampaign(campaignId: string): Promise<DonationModel[]> {
        return this.getModel().findMany({
            where: { campaignId },
            orderBy: { createdAt: "desc" },
        })
    }

    async findByDonor(donorId: string): Promise<DonationModel[]> {
        return this.getModel().findMany({
            where: { donorId },
            orderBy: { createdAt: "desc" },
        })
    }

    async createDonation(data: CreateDonationInput): Promise<DonationModel> {
        return this.create(data)
    }

    async updateDonation(
        id: string,
        data: UpdateDonationInput,
    ): Promise<DonationModel> {
        return this.update(id, data)
    }

    async findWithDetails(id: string): Promise<DonationWithRelations | null> {
        return this.getModel().findUnique({
            where: { id },
            include: {
                donor: true,
                campaign: true,
            },
        })
    }

    async getPublicDonations(campaignId: string): Promise<DonationModel[]> {
        return this.getModel().findMany({
            where: {
                campaignId,
                isPrivate: false,
            },
            include: {
                donor: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })
    }

    async getTotalDonationAmount(campaignId: string): Promise<number> {
        const result = await this.getModel().aggregate({
            where: { campaignId },
            _sum: {
                amount: true,
            },
        })

        return result._sum.amount || 0
    }

    async getDonationStats(campaignId: string): Promise<{
    totalAmount: number;
    totalDonors: number;
    averageDonation: number;
  }> {
        const [totalAmount, totalDonors] = await Promise.all([
            this.getTotalDonationAmount(campaignId),
            this.getModel().count({
                where: { campaignId },
                distinct: ["donorId"],
            }),
        ])

        return {
            totalAmount,
            totalDonors,
            averageDonation: totalDonors > 0 ? totalAmount / totalDonors : 0,
        }
    }

    async getTopDonors(campaignId: string, limit: number = 10): Promise<any[]> {
        return this.getModel().groupBy({
            by: ["donorId"],
            where: { campaignId },
            _sum: {
                amount: true,
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
