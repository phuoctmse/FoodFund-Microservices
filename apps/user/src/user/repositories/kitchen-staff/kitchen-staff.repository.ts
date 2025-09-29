import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateKitchenStaffProfileInput, UpdateKitchenStaffProfileInput } from "../types/user.types"

@Injectable()
export class KitchenStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createKitchenStaffProfile(userId: string) {
        return this.prisma.kitchen_Staff_Profile.create({
            data: { user_id: userId },
            include: { user: true },
        })
    }

    async findKitchenStaffProfile(userId: string) {
        return this.prisma.kitchen_Staff_Profile.findUnique({
            where: { user_id: userId },
            include: { user: true },
        })
    }

    async updateKitchenStaffProfile(id: string, data: UpdateKitchenStaffProfileInput) {
        return this.prisma.kitchen_Staff_Profile.update({
            where: { id },
            data: {
                ...(data.total_batch_prepared !== undefined && {
                    total_batch_prepared: data.total_batch_prepared,
                }),
            },
            include: { user: true },
        })
    }

    async deleteKitchenStaffProfile(id: string) {
        return this.prisma.kitchen_Staff_Profile.delete({ where: { id } })
    }

    // Kitchen staff specific queries
    async getTopCooks(limit: number = 10) {
        return this.prisma.kitchen_Staff_Profile.findMany({
            take: limit,
            orderBy: { total_batch_prepared: "desc" },
            include: { user: true },
        })
    }

    async getKitchenStaffStats(userId: string) {
        return this.prisma.kitchen_Staff_Profile.findUnique({
            where: { user_id: userId },
            select: {
                total_batch_prepared: true,
                user: {
                    select: {
                        full_name: true,
                        avatar_url: true,
                    },
                },
            },
        })
    }

    async getAllActiveKitchenStaff() {
        return this.prisma.kitchen_Staff_Profile.findMany({
            where: {
                user: {
                    is_active: true,
                },
            },
            include: { user: true },
        })
    }
}