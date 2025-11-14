import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { Role } from "../../../domain/enums/user.enum"
import {
    UpdateUserInput,
    UpdateUserAccountInput,
} from "../../dtos"

@Injectable()
export class UserAdminRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findAllUsers(skip: number = 0, take: number = 10) {
        return this.prisma.user.findMany({
            skip,
            take,
            include: {
                Organizations: true,
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
                Organizations: true,
            },
            orderBy: { created_at: "desc" },
        })
    }

    async getActiveUsers() {
        return this.prisma.user.findMany({
            where: { is_active: true },
            include: {
                Organizations: true,
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
                Organizations: true,
            },
            orderBy: { created_at: "desc" },
        })
    }

    async updateUser(
        id: string,
        data: UpdateUserInput | UpdateUserAccountInput,
    ) {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                Organizations: true,
                Organization_Member: true,
            },
        })
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id },
            include: {
                Organizations: true,
                Organization_Member: true,
            },
        })
    }
}
