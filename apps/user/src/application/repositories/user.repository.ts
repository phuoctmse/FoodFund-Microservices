import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"
import { v7 as uuidv7 } from "uuid"

import { Role, VerificationStatus } from "../../domain/enums/user.enum"
import {
    CreateStaffUserInput,
    CreateUserInput,
    UpdateUserInput,
} from "../../shared/types"

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaClient) { }

    // User CRUD operations
    async createUser(data: CreateUserInput) {
        return this.prisma.user.create({
            data: {
                id: uuidv7(),
                ...data,
                is_active: true,
            },
        })
    }

    async createStaffUser(data: CreateStaffUserInput) {
        const { organization_address, ...userData } = data

        return this.prisma.user.create({
            data: {
                ...userData,
                is_active: true,
            },
        })
    }

    async findAllUsers(skip?: number, take?: number) {
        return this.prisma.user.findMany({
            skip,
            take,
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { id, is_active: true },
        })
    }

    async findUserByCognitoIdSimple(cognito_id: string) {
        if (!cognito_id) {
            throw new Error("cognito_id is required")
        }

        return this.prisma.user.findUnique({
            where: { cognito_id, is_active: true },
        })
    }

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    async findUserByUsername(user_name: string) {
        return this.prisma.user.findUnique({
            where: { user_name },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    async findUserByCognitoId(cognito_id: string) {
        if (!cognito_id) {
            throw new Error("cognito_id is required")
        }

        return this.prisma.user.findUnique({
            where: { cognito_id },
            include: {
                User_Badge: {
                    include: {
                        badge: true,
                    },
                },
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    async updateUser(id: string, data: UpdateUserInput) {
        return this.prisma.user.update({
            where: { id },
            data,
        })
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    async findUserOrganization(userId: string) {
        return this.prisma.organization.findFirst({
            where: {
                representative_id: userId,
                status: VerificationStatus.VERIFIED,
            },
            include: {
                Organization_Member: true,
                user: true,
            },
        })
    }

    async findUserOrganizationAnyStatus(userId: string) {
        return this.prisma.organization.findFirst({
            where: {
                representative_id: userId,
            },
            include: {
                Organization_Member: true,
                user: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    async findUserOrganizations(userId: string) {
        return this.prisma.organization.findMany({
            where: {
                representative_id: userId,
            },
            include: {
                Organization_Member: true,
                user: true,
            },
        })
    }

    async updateUserRole(userId: string, role: Role) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { role },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    // Batch methods for DataLoader
    async findUsersByIds(userIds: string[]) {
        return this.prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })
    }

    async updateDonorStats(data: {
        donorId: string
        amountToAdd: bigint
        incrementCount: number
        lastDonationAt: Date
    }) {
        return this.prisma.user.update({
            where: { id: data.donorId },
            data: {
                total_donated: {
                    increment: data.amountToAdd,
                },
                donation_count: {
                    increment: data.incrementCount,
                },
                last_donation_at: data.lastDonationAt,
            },
            select: {
                id: true,
                total_donated: true,
                donation_count: true,
                last_donation_at: true,
            },
        })
    }

    /**
     * Find user with badge (for badge award optimization)
     * Single query with LEFT JOIN
     */
    async findUserWithBadge(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                User_Badge: {
                    include: {
                        badge: true,
                    },
                },
            },
        })
    }

    /**
     * Find user basic info (id + role only)
     * Used for lightweight queries
     */
    async findUserBasicInfo(cognitoId: string) {
        return this.prisma.user.findUnique({
            where: { cognito_id: cognitoId },
            select: {
                id: true,
                role: true,
            },
        })
    }

    /**
     * Find user full name by cognito_id
     * Used for display purposes
     */
    async findUserFullName(cognitoId: string) {
        return this.prisma.user.findUnique({
            where: { cognito_id: cognitoId, is_active: true },
            select: {
                id: true,
                full_name: true,
            },
        })
    }

    /**
     * Find users by IDs (lightweight - no relations)
     * Used for batch operations
     */
    async findUsersByIdsSimple(userIds: string[]): Promise<any[]> {
        return this.prisma.user.findMany({
            where: {
                id: {
                    in: userIds,
                },
                is_active: true,
            },
            select: {
                id: true,
                full_name: true,
                user_name: true,
                avatar_url: true,
            },
        })
    }
}
