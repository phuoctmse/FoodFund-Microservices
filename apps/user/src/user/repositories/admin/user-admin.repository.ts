import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { Role } from "libs/databases/prisma/schemas"
import { v7 as uuidv7 } from "uuid"
import { CreateStaffUserInput, UpdateUserInput } from "../types/user.types"

@Injectable()
export class UserAdminRepository {
    constructor(private readonly prisma: PrismaClient) {}

    // Admin-specific user management
    async createStaffUser(data: CreateStaffUserInput) {
        const { organization_address, ...userData } = data

        return this.prisma.user.create({
            data: {
                id: uuidv7(),
                ...userData,
                is_active: true,
            },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async findAllUsers(skip?: number, take?: number) {
        const validSkip = skip ?? 0
        const validTake = take ?? 10
        
        return this.prisma.user.findMany({
            skip: validSkip,
            take: validTake,
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    async getUsersByRole(role: Role) {
        return this.prisma.user.findMany({
            where: { role },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
            orderBy: { created_at: "desc" },
        })
    }

    async getActiveUsers() {
        return this.prisma.user.findMany({
            where: { is_active: true },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
            orderBy: { created_at: "desc" },
        })
    }

    async searchUsers(searchTerm: string, role?: Role) {
        const where: any = {
            AND: [
                {
                    OR: [
                        {
                            full_name: {
                                contains: searchTerm,
                                mode: "insensitive",
                            },
                        },
                        {
                            email: {
                                contains: searchTerm,
                                mode: "insensitive",
                            },
                        },
                        {
                            user_name: {
                                contains: searchTerm,
                                mode: "insensitive",
                            },
                        },
                    ],
                },
            ],
        }

        if (role) {
            where.AND.push({ role })
        }

        return this.prisma.user.findMany({
            where,
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
            orderBy: { created_at: "desc" },
        })
    }

    async updateUser(id: string, data: UpdateUserInput) {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true,
            },
        })
    }
}