import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { v7 as uuidv7 } from "uuid"
import { CreateUserInput } from "../../dto/user.types"

@Injectable()
export class UserCommonRepository {
    constructor(private readonly prisma: PrismaClient) {}

    // Common user operations
    async createUser(data: CreateUserInput) {
        return this.prisma.user.create({
            data: {
                id: uuidv7(),
                ...data,
                is_active: true,
            },
            include: {
                Donor_Profile: true
            },
        })
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
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
            where: { cognito_id }
        })
    }

    async updateUser(id: string, data: Partial<CreateUserInput & { is_active?: boolean }>) {
        return this.prisma.user.update({
            where: { id },
            data,
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Organizations: true,
                Delivery_Staff_Profile: true,
            },
        })
    }
}