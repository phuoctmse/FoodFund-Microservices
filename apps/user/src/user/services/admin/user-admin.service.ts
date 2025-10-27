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

        // Prevent deactivating admin accounts
        if (
            updateData.is_active === false &&
            existingUser.role === Role.ADMIN
        ) {
            throw new Error("Cannot deactivate admin accounts")
        }

        // Update in database
        const updatedUser = await this.userCommonRepository.updateUser(
            userId,
            updateData,
        )

        // Sync changes with AWS Cognito
        if (existingUser.cognito_id) {
            await this.syncUserWithCognito(existingUser, updateData)
        }

        this.logger.log(`Successfully updated user account: ${userId}`)
        return updatedUser
    }

    /**
     * Sync user changes with AWS Cognito
     */
    private async syncUserWithCognito(
        existingUser: any,
        updateData: UpdateUserAccountInput,
    ): Promise<void> {
        const cognitoId = existingUser.cognito_id

        try {
            // 1. Update email if changed
            if (updateData.email && updateData.email !== existingUser.email) {
                this.logger.log(
                    `Updating email in Cognito for user: ${cognitoId}`,
                )
                await this.awsCognitoService.updateUserAttributes(cognitoId, {
                    email: updateData.email,
                })
            }

            // 2. Enable/Disable user based on is_active status
            if (
                updateData.is_active !== undefined &&
                updateData.is_active !== existingUser.is_active
            ) {
                if (updateData.is_active === false) {
                    // Disable user in Cognito
                    this.logger.log(
                        `Disabling user in Cognito: ${cognitoId} (${existingUser.email})`,
                    )
                    await this.awsCognitoService.adminDisableUser(
                        existingUser.email,
                    )
                    this.logger.log(
                        `User disabled successfully in Cognito: ${cognitoId}`,
                    )
                } else {
                    // Enable user in Cognito
                    this.logger.log(
                        `Enabling user in Cognito: ${cognitoId} (${existingUser.email})`,
                    )
                    await this.awsCognitoService.adminEnableUser(
                        existingUser.email,
                    )
                    this.logger.log(
                        `User enabled successfully in Cognito: ${cognitoId}`,
                    )
                }
            }
        } catch (error) {
            // Log error but don't fail the whole operation
            this.logger.error(
                `Failed to sync user with Cognito: ${error instanceof Error ? error.message : error}`,
                {
                    cognitoId,
                    email: existingUser.email,
                    updateData,
                },
            )
            // Optionally: throw error to rollback database changes
            // throw new Error(`Failed to sync with Cognito: ${error.message}`)
        }
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
