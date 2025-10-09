// Export role-based repositories
export * from "./admin"
export * from "./common"
export * from "./donor"
export * from "./kitchen-staff"
export * from "./fundraiser"
export * from "./delivery-staff"
export * from "../dto/user.types"

// Keep original UserRepository for backward compatibility
import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"
import { Role, VerificationStatus } from "libs/databases/prisma/schemas"
import { v7 as uuidv7 } from "uuid"
import {
    CreateUserInput,
    CreateStaffUserInput,
    UpdateUserInput,
} from "../dto/user.types"

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
            include: {
                Donor_Profile: true,
                // Kitchen_Staff_Profile: true,
                // Fundraiser_Profile: true,
                // Delivery_Staff_Profile: true
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
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { cognito_id: id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async findUserByUsername(user_name: string) {
        return this.prisma.user.findUnique({
            where: { user_name },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async findUserByCognitoId(cognito_id: string) {
        return this.prisma.user.findUnique({
            where: { cognito_id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }

    async updateUser(id: string, data: UpdateUserInput) {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                Donor_Profile: true,
                // Kitchen_Staff_Profile: true,
                // Fundraiser_Profile: true,
                // Delivery_Staff_Profile: true,
            },
        })
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
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
                user: {
                    include: {
                        Donor_Profile: true,
                        Kitchen_Staff_Profile: true,
                        Delivery_Staff_Profile: true,
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
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
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
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }
}
