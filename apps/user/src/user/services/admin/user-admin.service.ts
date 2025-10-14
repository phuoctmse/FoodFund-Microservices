import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { UpdateUserInput, UpdateUserAccountInput } from "../../dto/user.input"
import { AwsCognitoService } from "libs/aws-cognito"
import { UserAdminRepository, UserCommonRepository } from "../../repositories"
import { Role } from "../../enums/user.enum"

@Injectable()
export class UserAdminService {
    private readonly logger = new Logger(UserAdminService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly userAdminRepository: UserAdminRepository,
        private readonly userCommonRepository: UserCommonRepository,
    ) {}

    async updateStaffAccount(
        staffId: string,
        updateData: UpdateUserInput,
        adminUserId: string,
    ) {
        this.logger.log(`Admin ${adminUserId} updating staff ${staffId}`)

        // Validate admin role
        const admin = await this.userCommonRepository.findUserById(adminUserId)
        if (!admin || admin.role !== Role.ADMIN) {
            throw new Error(
                "Unauthorized: Only admins can update staff accounts",
            )
        }

        // Validate staff exists and is staff role
        const staff = await this.userCommonRepository.findUserById(staffId)
        if (!staff) {
            throw new NotFoundException("Staff not found")
        }

        const staffRoles = [
            Role.KITCHEN_STAFF,
            Role.DELIVERY_STAFF,
            Role.FUNDRAISER,
        ]
        if (!staffRoles.includes(staff.role as Role)) {
            throw new Error("Can only update staff accounts")
        }

        return this.userAdminRepository.updateUser(staffId, updateData)
    }

    async getAllAccounts(skip: number = 0, take: number = 10) {
        this.logger.log(
            `Getting all accounts with skip: ${skip}, take: ${take}`,
        )
        return this.userAdminRepository.findAllUsers(skip, take)
    }

    async updateAccountStatus(
        userId: string,
        isActive: boolean,
        adminUserId: string,
    ) {
        this.logger.log(
            `Admin ${adminUserId} updating account ${userId} status to ${isActive}`,
        )

        // Validate admin role
        const admin = await this.userCommonRepository.findUserById(adminUserId)
        if (!admin || admin.role !== Role.ADMIN) {
            throw new Error(
                "Unauthorized: Only admins can update account status",
            )
        }

        // Cannot deactivate other admins
        const targetUser = await this.userCommonRepository.findUserById(userId)
        if (!targetUser) {
            throw new NotFoundException("User not found")
        }

        if (targetUser.role === Role.ADMIN && !isActive) {
            throw new Error("Cannot deactivate admin accounts")
        }

        return this.userAdminRepository.updateUser(userId, {
            is_active: isActive,
        })
    }

    async getStaffAccounts() {
        this.logger.log("Getting all staff accounts")
        const staffRoles = [
            Role.KITCHEN_STAFF,
            Role.DELIVERY_STAFF,
            Role.FUNDRAISER,
        ]
        const allStaff = await Promise.all(
            staffRoles.map((role) =>
                this.userAdminRepository.getUsersByRole(role),
            ),
        )
        return allStaff.flat()
    }

    async getDonorAccounts() {
        this.logger.log("Getting all donor accounts")
        return this.userAdminRepository.getUsersByRole(Role.DONOR)
    }

    async updateUserAccount(
        userId: string,
        updateData: UpdateUserAccountInput,
    ) {
        this.logger.log(`Admin updating user account: ${userId}`)

        // Check if user exists
        const existingUser =
            await this.userCommonRepository.findUserById(userId)
        if (!existingUser) {
            throw new NotFoundException(`User with ID ${userId} not found`)
        }

        // Update in database
        const updatedUser = await this.userCommonRepository.updateUser(
            userId,
            updateData,
        )

        // If email changed, update in Cognito too
        if (updateData.email && updateData.email !== existingUser.email) {
            try {
                await this.awsCognitoService.updateUserAttributes(
                    existingUser.cognito_id!,
                    {
                        email: updateData.email,
                    },
                )
            } catch (error) {
                this.logger.warn(
                    `Failed to update email in Cognito: ${error.message}`,
                )
                // Don't fail the whole operation, just log the warning
            }
        }

        this.logger.log(`Successfully updated user account: ${userId}`)
        return updatedUser
    }

    async getAdminProfile(cognitoId: string) {
        this.logger.log(`Getting admin profile for cognito_id: ${cognitoId}`)

        const admin =
            await this.userCommonRepository.findUserByCognitoId(cognitoId)
        if (!admin) {
            throw new NotFoundException("Admin not found")
        }

        if (admin.role !== Role.ADMIN) {
            throw new Error("User is not an admin")
        }

        return {
            user: admin,
        }
    }

    async getAllUsers(offset: number = 0, limit: number = 10) {
        this.logger.log(
            `Admin getting all users with offset: ${offset}, limit: ${limit}`,
        )
        return this.userAdminRepository.findAllUsers(offset, limit)
    }
}
