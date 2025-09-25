import { Injectable } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { Role } from "libs/databases/prisma/schemas"
import { v7 as uuidv7 } from "uuid"
import { 
    CreateUserInput, 
    CreateStaffUserInput,
    UpdateUserInput,
    CreateDonorProfileInput,
    UpdateDonorProfileInput,
    CreateKitchenStaffProfileInput,
    UpdateKitchenStaffProfileInput,
    CreateFundraiserProfileInput,
    UpdateFundraiserProfileInput,
    CreateDeliveryStaffProfileInput,
    UpdateDeliveryStaffProfileInput
} from "./types/user.types"

// Re-export types for use in other modules
export type {
    CreateUserInput,
    CreateStaffUserInput,
    UpdateUserInput,
    CreateDonorProfileInput,
    UpdateDonorProfileInput,
    CreateKitchenStaffProfileInput,
    UpdateKitchenStaffProfileInput,
    CreateFundraiserProfileInput,
    UpdateFundraiserProfileInput,
    CreateDeliveryStaffProfileInput,
    UpdateDeliveryStaffProfileInput
}

@Injectable()
export class UserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    // User CRUD operations
    async createUser(data: CreateUserInput) {
        return this.prisma.user.create({
            data: {
                id: uuidv7(),
                ...data,
                is_active: true
            },
            include: {
                Donor_Profile: true,
                // Kitchen_Staff_Profile: true,
                // Fundraiser_Profile: true,
                // Delivery_Staff_Profile: true
            }
        })
    }

    async createStaffUser(data: CreateStaffUserInput) {
        const { organization_address, ...userData } = data
        
        return this.prisma.user.create({
            data: {
                ...userData,
                is_active: true
            }
        })
    }

    async findAllUsers(skip?: number, take?: number) {
        return this.prisma.user.findMany({
            skip,
            take,
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            },
            orderBy: {
                created_at: "desc"
            }
        })
    }

    async findUserById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            }
        })
    }

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            }
        })
    }

    async findUserByUsername(user_name: string) {
        return this.prisma.user.findUnique({
            where: { user_name },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            }
        })
    }

    async findUserByCognitoId(cognito_id: string) {
        return this.prisma.user.findUnique({
            where: { cognito_id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            }
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
                Delivery_Staff_Profile: true
            }
        })
    }

    async deleteUser(id: string) {
        return this.prisma.user.delete({
            where: { id },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            }
        })
    }

    async softDeleteUser(id: string) {
        return this.updateUser(id, { is_active: false })
    }

    // Profile operations
    async createDonorProfile(userId: string) {
        return this.prisma.donor_Profile.create({
            data: { user_id: userId },
            include: { user: true }
        })
    }

    async createKitchenStaffProfile(userId: string) {
        return this.prisma.kitchen_Staff_Profile.create({
            data: { user_id: userId },
            include: { user: true }
        })
    }

    async createFundraiserProfile(userId: string, organizationAddress?: string) {
        return this.prisma.fundraiser_Profile.create({
            data: {
                user_id: userId,
                organization_address: organizationAddress
            },
            include: { user: true }
        })
    }

    async createDeliveryStaffProfile(userId: string) {
        return this.prisma.delivery_Staff_Profile.create({
            data: { user_id: userId },
            include: { user: true }
        })
    }

    // Profile update operations
    async updateDonorProfile(id: string, data: UpdateDonorProfileInput) {
        return this.prisma.donor_Profile.update({
            where: { id },
            data: {
                ...(data.donation_count !== undefined && { donation_count: data.donation_count }),
                ...(data.total_donated !== undefined && { total_donated: data.total_donated })
            },
            include: { user: true }
        })
    }

    async updateKitchenStaffProfile(id: string, data: UpdateKitchenStaffProfileInput) {
        return this.prisma.kitchen_Staff_Profile.update({
            where: { id },
            data: {
                ...(data.total_batch_prepared !== undefined && { total_batch_prepared: data.total_batch_prepared })
            },
            include: { user: true }
        })
    }

    async updateFundraiserProfile(id: string, data: UpdateFundraiserProfileInput) {
        return this.prisma.fundraiser_Profile.update({
            where: { id },
            data: {
                ...(data.organization_address !== undefined && { organization_address: data.organization_address }),
                ...(data.verification_status !== undefined && { verification_status: data.verification_status as any }),
                ...(data.total_campaign_created !== undefined && { total_campaign_created: data.total_campaign_created })
            },
            include: { user: true }
        })
    }

    async updateDeliveryStaffProfile(id: string, data: UpdateDeliveryStaffProfileInput) {
        return this.prisma.delivery_Staff_Profile.update({
            where: { id },
            data: {
                ...(data.availability_status !== undefined && { availability_status: data.availability_status as any }),
                ...(data.total_deliveries !== undefined && { total_deliveries: data.total_deliveries })
            },
            include: { user: true }
        })
    }

    // Profile delete operations
    async deleteDonorProfile(id: string) {
        return this.prisma.donor_Profile.delete({ where: { id } })
    }

    async deleteKitchenStaffProfile(id: string) {
        return this.prisma.kitchen_Staff_Profile.delete({ where: { id } })
    }

    async deleteFundraiserProfile(id: string) {
        return this.prisma.fundraiser_Profile.delete({ where: { id } })
    }

    async deleteDeliveryStaffProfile(id: string) {
        return this.prisma.delivery_Staff_Profile.delete({ where: { id } })
    }

    // Search operations
    async searchUsers(searchTerm: string, role?: Role) {
        const where: any = {
            AND: [
                {
                    OR: [
                        { full_name: { contains: searchTerm, mode: "insensitive" } },
                        { email: { contains: searchTerm, mode: "insensitive" } },
                        { user_name: { contains: searchTerm, mode: "insensitive" } }
                    ]
                }
            ]
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
                Delivery_Staff_Profile: true
            },
            orderBy: { created_at: "desc" }
        })
    }

    async getUsersByRole(role: Role) {
        return this.prisma.user.findMany({
            where: { role },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            },
            orderBy: { created_at: "desc" }
        })
    }

    async getActiveUsers() {
        return this.prisma.user.findMany({
            where: { is_active: true },
            include: {
                Donor_Profile: true,
                Kitchen_Staff_Profile: true,
                Fundraiser_Profile: true,
                Delivery_Staff_Profile: true
            },
            orderBy: { created_at: "desc" }
        })
    }
}
