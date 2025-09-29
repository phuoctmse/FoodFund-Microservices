import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { CreateStaffAccountInput, UpdateUserInput, UpdateUserAccountInput } from "../../dto/user.input"
import { CreateStaffAccountResponse } from "../../types/staff-response.model"
import { AwsCognitoService } from "libs/aws-cognito"
import { UserAdminRepository, UserCommonRepository } from "../../repositories"
import { Role } from "libs/databases/prisma/schemas"
import { generateUniqueUsername } from "libs/common"

@Injectable()
export class UserAdminService {
    private readonly logger = new Logger(UserAdminService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly userAdminRepository: UserAdminRepository,
        private readonly userCommonRepository: UserCommonRepository,
    ) {}

    // 1. Admin Business Logic: Tạo staff account
    async createStaffAccount(
        input: CreateStaffAccountInput,
        adminUserId: string,
    ): Promise<CreateStaffAccountResponse> {
        this.logger.log(`Admin ${adminUserId} creating staff account for ${input.email}`)

        try {
            // Validate admin role
            const admin = await this.userCommonRepository.findUserById(adminUserId)
            if (!admin || admin.role !== Role.ADMIN) {
                throw new Error("Unauthorized: Only admins can create staff accounts")
            }

            // Validate staff role
            const validStaffRoles = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF, Role.FUNDRAISER]
            if (!validStaffRoles.includes(input.role as Role)) {
                throw new Error("Invalid role: Only KITCHEN_STAFF, DELIVERY_STAFF, FUNDRAISER allowed")
            }

            // Create Cognito user
            const cognitoResult = await this.awsCognitoService.signUp(
                input.email,
                input.password,
                {
                    name: input.full_name,
                    phone_number: input.phone_number,
                    "custom:role": input.role,
                },
            )

            if (!cognitoResult.userSub) {
                throw new Error("Failed to create Cognito user")
            }

            await this.awsCognitoService.adminConfirmSignUp(input.email)

            // Create user in database
            const userData = {
                cognito_id: cognitoResult.userSub,
                email: input.email,
                user_name: generateUniqueUsername(input.email),
                full_name: input.full_name,
                phone_number: input.phone_number || "",
                avatar_url: input.avatar_url || "",
                bio: input.bio || "",
                role: input.role as Role,
                organization_address: input.organization_address || "",
            }

            const user = await this.userAdminRepository.createStaffUser(userData)

            return {
                success: true,
                message: "Staff account created successfully",
                userId: user.id,
                cognitoId: cognitoResult.userSub,
                hasLoginAccess: true,
                temporaryPasswordSent: true,
            }
        } catch (error) {
            this.logger.error(`Failed to create staff account: ${error.message}`)
            return {
                success: false,
                message: error.message,
                userId: "",
                cognitoId: "",
                hasLoginAccess: false,
                temporaryPasswordSent: false,
            }
        }
    }

    // 2. Admin Business Logic: Update staff account
    async updateStaffAccount(staffId: string, updateData: UpdateUserInput, adminUserId: string) {
        this.logger.log(`Admin ${adminUserId} updating staff ${staffId}`)

        // Validate admin role
        const admin = await this.userCommonRepository.findUserById(adminUserId)
        if (!admin || admin.role !== Role.ADMIN) {
            throw new Error("Unauthorized: Only admins can update staff accounts")
        }

        // Validate staff exists and is staff role
        const staff = await this.userCommonRepository.findUserById(staffId)
        if (!staff) {
            throw new NotFoundException("Staff not found")
        }

        const staffRoles = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF, Role.FUNDRAISER]
        if (!staffRoles.includes(staff.role as Role)) {
            throw new Error("Can only update staff accounts")
        }

        return this.userAdminRepository.updateUser(staffId, updateData)
    }

    // 3. Admin Business Logic: Get all accounts (staff + donor)
    async getAllAccounts(skip?: number, take?: number) {
        this.logger.log(`Getting all accounts with skip: ${skip}, take: ${take}`)
        return this.userAdminRepository.findAllUsers(skip, take)
    }

    // 4. Admin Business Logic: Update account status (is_active)
    async updateAccountStatus(userId: string, isActive: boolean, adminUserId: string) {
        this.logger.log(`Admin ${adminUserId} updating account ${userId} status to ${isActive}`)

        // Validate admin role
        const admin = await this.userCommonRepository.findUserById(adminUserId)
        if (!admin || admin.role !== Role.ADMIN) {
            throw new Error("Unauthorized: Only admins can update account status")
        }

        // Cannot deactivate other admins
        const targetUser = await this.userCommonRepository.findUserById(userId)
        if (!targetUser) {
            throw new NotFoundException("User not found")
        }

        if (targetUser.role === Role.ADMIN && !isActive) {
            throw new Error("Cannot deactivate admin accounts")
        }

        return this.userAdminRepository.updateUser(userId, { is_active: isActive })
    }

    // 5. Admin Business Logic: Get staff accounts only
    async getStaffAccounts() {
        this.logger.log("Getting all staff accounts")
        const staffRoles = [Role.KITCHEN_STAFF, Role.DELIVERY_STAFF, Role.FUNDRAISER]
        const allStaff = await Promise.all(
            staffRoles.map(role => this.userAdminRepository.getUsersByRole(role))
        )
        return allStaff.flat()
    }

    // 6. Admin Business Logic: Get donor accounts only  
    async getDonorAccounts() {
        this.logger.log("Getting all donor accounts")
        return this.userAdminRepository.getUsersByRole(Role.DONOR)
    }

    // 7. Admin Business Logic: Update user account (all roles)
    async updateUserAccount(userId: string, updateData: UpdateUserAccountInput) {
        this.logger.log(`Admin updating user account: ${userId}`)
        
        // Check if user exists
        const existingUser = await this.userCommonRepository.findUserById(userId)
        if (!existingUser) {
            throw new NotFoundException(`User with ID ${userId} not found`)
        }

        // Update in database
        const updatedUser = await this.userCommonRepository.updateUser(userId, updateData)

        // If email changed, update in Cognito too
        if (updateData.email && updateData.email !== existingUser.email) {
            try {
                await this.awsCognitoService.updateUserAttributes(existingUser.cognito_id!, {
                    email: updateData.email
                })
            } catch (error) {
                this.logger.warn(`Failed to update email in Cognito: ${error.message}`)
                // Don't fail the whole operation, just log the warning
            }
        }

        this.logger.log(`Successfully updated user account: ${userId}`)
        return updatedUser
    }

    // 8. Admin Business Logic: Get admin profile (for consistency with other roles)
    async getAdminProfile(cognitoId: string) {
        this.logger.log(`Getting admin profile for cognito_id: ${cognitoId}`)
        
        const admin = await this.userCommonRepository.findUserByCognitoId(cognitoId)
        if (!admin) {
            throw new NotFoundException("Admin not found")
        }

        if (admin.role !== Role.ADMIN) {
            throw new Error("User is not an admin")
        }


        // Admin doesn't have specific profile table, return user info
        return {
            user: admin
        }
    }
}