import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateDonorProfileInput, UpdateDonorProfileInput } from "../types/user.types"

@Injectable()
export class DonorRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createDonorProfile(userId: string) {
        return this.prisma.donor_Profile.create({
            data: { user_id: userId },
            include: { user: true },
        })
    }

    async findDonorProfile(userId: string) {
        return this.prisma.donor_Profile.findUnique({
            where: { user_id: userId },
            include: { user: true },
        })
    }

    async updateDonorProfile(id: string, data: UpdateDonorProfileInput) {
        return this.prisma.donor_Profile.update({
            where: { id },
            data: {
                ...(data.donation_count !== undefined && {
                    donation_count: data.donation_count,
                }),
                ...(data.total_donated !== undefined && {
                    total_donated: data.total_donated,
                }),
            },
            include: { user: true },
        })
    }

    async deleteDonorProfile(id: string) {
        return this.prisma.donor_Profile.delete({ where: { id } })
    }

    // Donor-specific queries
    async getTopDonors(limit: number = 10) {
        return this.prisma.donor_Profile.findMany({
            take: limit,
            orderBy: { total_donated: "desc" },
            include: { user: true },
        })
    }

    async getDonorStats(userId: string) {
        return this.prisma.donor_Profile.findUnique({
            where: { user_id: userId },
            select: {
                donation_count: true,
                total_donated: true,
                user: {
                    select: {
                        full_name: true,
                        avatar_url: true,
                    },
                },
            },
        })
    }
}