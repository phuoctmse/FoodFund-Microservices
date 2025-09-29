import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateDeliveryStaffProfileInput, UpdateDeliveryStaffProfileInput } from "../types/user.types"

@Injectable()
export class DeliveryStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createDeliveryStaffProfile(userId: string) {
        return this.prisma.delivery_Staff_Profile.create({
            data: { user_id: userId },
            include: { user: true },
        })
    }

    async findDeliveryStaffProfile(userId: string) {
        return this.prisma.delivery_Staff_Profile.findUnique({
            where: { user_id: userId },
            include: { user: true },
        })
    }

    async updateDeliveryStaffProfile(id: string, data: UpdateDeliveryStaffProfileInput) {
        return this.prisma.delivery_Staff_Profile.update({
            where: { id },
            data: {
                ...(data.availability_status !== undefined && {
                    availability_status: data.availability_status as any,
                }),
                ...(data.total_deliveries !== undefined && {
                    total_deliveries: data.total_deliveries,
                }),
            },
            include: { user: true },
        })
    }

    async deleteDeliveryStaffProfile(id: string) {
        return this.prisma.delivery_Staff_Profile.delete({ where: { id } })
    }

    // Delivery staff specific queries
    async getTopDeliveryStaff(limit: number = 10) {
        return this.prisma.delivery_Staff_Profile.findMany({
            take: limit,
            orderBy: { total_deliveries: "desc" },
            include: { user: true },
        })
    }

    async getAvailableDeliveryStaff() {
        return this.prisma.delivery_Staff_Profile.findMany({
            where: { availability_status: "AVAILABLE" },
            include: { user: true },
        })
    }

    async getDeliveryStaffStats(userId: string) {
        return this.prisma.delivery_Staff_Profile.findUnique({
            where: { user_id: userId },
            select: {
                total_deliveries: true,
                availability_status: true,
                user: {
                    select: {
                        full_name: true,
                        avatar_url: true,
                    },
                },
            },
        })
    }

    async updateAvailabilityStatus(userId: string, status: string) {
        return this.prisma.delivery_Staff_Profile.update({
            where: { user_id: userId },
            data: { availability_status: status as any },
            include: { user: true },
        })
    }
}