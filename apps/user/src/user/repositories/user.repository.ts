import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"
import { v7 as uuidv7 } from "uuid"
import {
    CreateStaffUserInput,
    CreateUserInput,
    UpdateUserInput,
} from "../types/user.types"
import { Role, VerificationStatus } from "../enums/user.enum"

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaClient) {}

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
            where: { cognito_id: id },
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
        return this.prisma.user.findUnique({
            where: { cognito_id },
            include: {
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
                Organization_Member: {
                    include: {
                        member: true,
                    },
                },
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
}
