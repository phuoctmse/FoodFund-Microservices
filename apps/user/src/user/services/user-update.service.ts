import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from "@nestjs/common"
import {
    UserRepository,
    UpdateUserInput,
    UpdateDonorProfileInput,
    UpdateKitchenStaffProfileInput,
    UpdateFundraiserProfileInput,
    UpdateDeliveryStaffProfileInput,
} from "../user.repository"

@Injectable()
export class UserUpdateService {
    constructor(private readonly userRepository: UserRepository) {}

    async updateUser(id: string, updateUserInput: UpdateUserInput) {
        try {
            const existingUser = await this.userRepository.findUserById(id)
            if (!existingUser) {
                throw new NotFoundException(`User with ID ${id} not found`)
            }

            if (
                updateUserInput.email &&
                updateUserInput.email !== existingUser.email
            ) {
                const existingEmailUser =
                    await this.userRepository.findUserByEmail(
                        updateUserInput.email,
                    )
                if (existingEmailUser) {
                    throw new ConflictException("Email already exists")
                }
            }

            if (
                updateUserInput.user_name &&
                updateUserInput.user_name !== existingUser.user_name
            ) {
                const existingUsernameUser =
                    await this.userRepository.findUserByUsername(
                        updateUserInput.user_name,
                    )
                if (existingUsernameUser) {
                    throw new ConflictException("Username already exists")
                }
            }

            return await this.userRepository.updateUser(id, updateUserInput)
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof ConflictException
            ) {
                throw error
            }
            throw new BadRequestException("Failed to update user")
        }
    }

    async deleteUser(id: string) {
        try {
            const user = await this.userRepository.findUserById(id)
            if (!user) {
                throw new NotFoundException(`User with ID ${id} not found`)
            }

            return await this.userRepository.deleteUser(id)
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            throw new BadRequestException("Failed to delete user")
        }
    }

    async softDeleteUser(id: string) {
        try {
            const user = await this.userRepository.findUserById(id)
            if (!user) {
                throw new NotFoundException(`User with ID ${id} not found`)
            }

            return await this.userRepository.softDeleteUser(id)
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error
            }
            throw new BadRequestException("Failed to soft delete user")
        }
    }

    // Profile update operations
    async updateDonorProfile(
        id: string,
        updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        try {
            return await this.userRepository.updateDonorProfile(
                id,
                updateDonorProfileInput,
            )
        } catch (error) {
            throw new BadRequestException("Failed to update donor profile")
        }
    }

    async deleteDonorProfile(id: string) {
        try {
            return await this.userRepository.deleteDonorProfile(id)
        } catch (error) {
            throw new BadRequestException("Failed to delete donor profile")
        }
    }

    async updateKitchenStaffProfile(
        id: string,
        updateKitchenStaffProfileInput: UpdateKitchenStaffProfileInput,
    ) {
        try {
            return await this.userRepository.updateKitchenStaffProfile(
                id,
                updateKitchenStaffProfileInput,
            )
        } catch (error) {
            throw new BadRequestException(
                "Failed to update kitchen staff profile",
            )
        }
    }

    async deleteKitchenStaffProfile(id: string) {
        try {
            return await this.userRepository.deleteKitchenStaffProfile(id)
        } catch (error) {
            throw new BadRequestException(
                "Failed to delete kitchen staff profile",
            )
        }
    }

    async updateFundraiserProfile(
        id: string,
        updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    ) {
        try {
            return await this.userRepository.updateFundraiserProfile(
                id,
                updateFundraiserProfileInput,
            )
        } catch (error) {
            throw new BadRequestException("Failed to update fundraiser profile")
        }
    }

    async deleteFundraiserProfile(id: string) {
        try {
            return await this.userRepository.deleteFundraiserProfile(id)
        } catch (error) {
            throw new BadRequestException("Failed to delete fundraiser profile")
        }
    }

    async updateDeliveryStaffProfile(
        id: string,
        updateDeliveryStaffProfileInput: UpdateDeliveryStaffProfileInput,
    ) {
        try {
            return await this.userRepository.updateDeliveryStaffProfile(
                id,
                updateDeliveryStaffProfileInput,
            )
        } catch (error) {
            throw new BadRequestException(
                "Failed to update delivery staff profile",
            )
        }
    }

    async deleteDeliveryStaffProfile(id: string) {
        try {
            return await this.userRepository.deleteDeliveryStaffProfile(id)
        } catch (error) {
            throw new BadRequestException(
                "Failed to delete delivery staff profile",
            )
        }
    }
}
