import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { IUserRepository } from "../../../domain/interfaces"
import { User } from "../../../domain/entities"
import { UserMapper } from "../../../shared/mappers"
import { Role } from "../../../domain/enums"
import { v7 as uuidv7 } from "uuid"

/**
 * Infrastructure: User Repository Adapter
 * Implements IUserRepository interface using Prisma
 */
@Injectable()
export class UserRepositoryAdapter implements IUserRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly userMapper: UserMapper,
    ) {}

    // ============================================
    // Create
    // ============================================

    async create(userData: Partial<User>): Promise<User> {
        const dbData = {
            id: uuidv7(),
            cognito_id: userData.cognitoId,
            email: userData.email,
            user_name: userData.username,
            full_name: userData.fullName,
            is_active: true,
            role: userData.role,
            avatar_url: userData.avatarUrl,
            phone_number: userData.phoneNumber,
            bio: userData.bio,
            address: userData.address,
        }

        const created = await this.prisma.user.create({
            data: dbData as any,
        })

        return this.userMapper.toDomain(created)
    }

    // ============================================
    // Read
    // ============================================

    async findById(id: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { id },
        })

        return user ? this.userMapper.toDomain(user) : null
    }

    async findByCognitoId(cognitoId: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { cognito_id: cognitoId },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return user ? this.userMapper.toDomain(user) : null
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return user ? this.userMapper.toDomain(user) : null
    }

    async findByUsername(username: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { user_name: username },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return user ? this.userMapper.toDomain(user) : null
    }

    async findAll(skip?: number, take?: number): Promise<User[]> {
        const users = await this.prisma.user.findMany({
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

        return users.map((user) => this.userMapper.toDomain(user))
    }

    async findByIds(ids: string[]): Promise<User[]> {
        const users = await this.prisma.user.findMany({
            where: {
                id: { in: ids },
            },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return users.map((user) => this.userMapper.toDomain(user))
    }

    // ============================================
    // Update
    // ============================================

    async update(id: string, data: Partial<User>): Promise<User> {
        const updateData: any = {}

        if (data.fullName !== undefined)
            updateData.full_name = data.fullName
        if (data.email !== undefined) updateData.email = data.email
        if (data.username !== undefined)
            updateData.user_name = data.username
        if (data.avatarUrl !== undefined)
            updateData.avatar_url = data.avatarUrl
        if (data.phoneNumber !== undefined)
            updateData.phone_number = data.phoneNumber
        if (data.bio !== undefined) updateData.bio = data.bio
        if (data.address !== undefined) updateData.address = data.address
        if (data.isActive !== undefined)
            updateData.is_active = data.isActive

        const updated = await this.prisma.user.update({
            where: { id },
            data: updateData,
        })

        return this.userMapper.toDomain(updated)
    }

    async updateRole(id: string, role: Role): Promise<User> {
        const updated = await this.prisma.user.update({
            where: { id },
            data: { role },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return this.userMapper.toDomain(updated)
    }

    // ============================================
    // Delete
    // ============================================

    async delete(id: string): Promise<User> {
        const deleted = await this.prisma.user.delete({
            where: { id },
            include: {
                Organizations: {
                    include: {
                        Organization_Member: true,
                    },
                },
            },
        })

        return this.userMapper.toDomain(deleted)
    }

    // ============================================
    // Business Queries
    // ============================================

    async findActiveUsers(): Promise<User[]> {
        const users = await this.prisma.user.findMany({
            where: { is_active: true },
            orderBy: {
                created_at: "desc",
            },
        })

        return users.map((user) => this.userMapper.toDomain(user))
    }

    async findUsersByRole(role: Role): Promise<User[]> {
        const users = await this.prisma.user.findMany({
            where: { role },
            orderBy: {
                created_at: "desc",
            },
        })

        return users.map((user) => this.userMapper.toDomain(user))
    }
}
