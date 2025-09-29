import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateFundraiserProfileInput, UpdateFundraiserProfileInput } from "../types/user.types"

@Injectable()
export class FundraiserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createFundraiserProfile(userId: string, organizationAddress?: string) {
        return this.prisma.fundraiser_Profile.create({
            data: {
                user_id: userId,
                organization_address: organizationAddress,
            },
            include: { user: true },
        })
    }

    async findFundraiserProfile(userId: string) {
        return this.prisma.fundraiser_Profile.findUnique({
            where: { user_id: userId },
            include: { user: true },
        })
    }

    async updateFundraiserProfile(id: string, data: UpdateFundraiserProfileInput) {
        return this.prisma.fundraiser_Profile.update({
            where: { id },
            data: {
                ...(data.organization_address !== undefined && {
                    organization_address: data.organization_address,
                }),
                ...(data.verification_status !== undefined && {
                    verification_status: data.verification_status as any,
                }),
                ...(data.total_campaign_created !== undefined && {
                    total_campaign_created: data.total_campaign_created,
                }),
            },
            include: { user: true },
        })
    }

    async deleteFundraiserProfile(id: string) {
        return this.prisma.fundraiser_Profile.delete({ where: { id } })
    }

    // Fundraiser specific queries
    async getTopFundraisers(limit: number = 10) {
        return this.prisma.fundraiser_Profile.findMany({
            take: limit,
            orderBy: { total_campaign_created: "desc" },
            include: { user: true },
        })
    }

    async getVerifiedFundraisers() {
        return this.prisma.fundraiser_Profile.findMany({
            where: { verification_status: "VERIFIED" },
            include: { user: true },
        })
    }

    async getFundraiserStats(userId: string) {
        return this.prisma.fundraiser_Profile.findUnique({
            where: { user_id: userId },
            select: {
                total_campaign_created: true,
                verification_status: true,
                organization_address: true,
                user: {
                    select: {
                        full_name: true,
                        avatar_url: true,
                    },
                },
            },
        })
    }

    async getPendingVerifications() {
        return this.prisma.fundraiser_Profile.findMany({
            where: { verification_status: "PENDING" },
            include: { user: true },
        })
    }
}