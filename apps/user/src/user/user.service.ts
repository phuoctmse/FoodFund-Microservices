import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from "@nestjs/common"
import { 
    UserRepository, 
    CreateUserInput, 
    UpdateUserInput,
    UpdateDonorProfileInput,
    UpdateKitchenStaffProfileInput,
    UpdateFundraiserProfileInput,
    UpdateDeliveryStaffProfileInput
} from "./user.repository"

// Import GraphQL models from shared libs for response typing
import { Role } from "libs/databases/prisma/schemas"

@Injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    // User CRUD operations
    async createUser(createUserInput: CreateUserInput) {
        try {
            // Check if email already exists
            const existingEmailUser = await this.userRepository.findUserByEmail(
                createUserInput.email,
            )
            if (existingEmailUser) {
                throw new ConflictException("Email already exists")
            }

            // Check if username already exists
            const existingUsernameUser = await this.userRepository.findUserByUsername(
                createUserInput.user_name,
            )
            if (existingUsernameUser) {
                throw new ConflictException("Username already exists")
            }

            const user = await this.userRepository.createUser(createUserInput)

            // Automatically create corresponding profile based on role
            await this.createProfileForUser(user.id, user.role as Role)

            return await this.userRepository.findUserById(user.id)
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error
            }
            throw new BadRequestException("Failed to create user")
        }
    }

    async findAllUsers(skip?: number, take?: number) {
        return this.userRepository.findAllUsers(skip, take)
    }

    async findUserById(id: string) {
        const user = await this.userRepository.findUserById(id)
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`)
        }
        return user
    }

    async findUserByEmail(email: string) {
        const user = await this.userRepository.findUserByEmail(email)
        if (!user) {
            throw new NotFoundException(`User with email ${email} not found`)
        }
        return user
    }

    async findUserByUsername(user_name: string) {
        const user = await this.userRepository.findUserByUsername(user_name)
        if (!user) {
            throw new NotFoundException(`User with username ${user_name} not found`)
        }
        return user
    }

    async updateUser(id: string, updateUserInput: UpdateUserInput) {
        try {
            // Check if user exists
            const existingUser = await this.userRepository.findUserById(id)
            if (!existingUser) {
                throw new NotFoundException(`User with ID ${id} not found`)
            }

            // Check if email is being updated and if it already exists
            if (
                updateUserInput.email &&
        updateUserInput.email !== existingUser.email
            ) {
                const existingEmailUser = await this.userRepository.findUserByEmail(
                    updateUserInput.email,
                )
                if (existingEmailUser) {
                    throw new ConflictException("Email already exists")
                }
            }

            // Check if username is being updated and if it already exists
            if (
                updateUserInput.user_name &&
                updateUserInput.user_name !== existingUser.user_name
            ) {
                const existingUsernameUser = await this.userRepository.findUserByUsername(
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

    // Profile management
    private async createProfileForUser(userId: string, role: Role) {
        switch (role) {
        case Role.DONOR:
            await this.userRepository.createDonorProfile(userId)
            break
        case Role.KITCHEN_STAFF:
            await this.userRepository.createKitchenStaffProfile(userId)
            break
        case Role.FUNDRAISER:
            await this.userRepository.createFundraiserProfile(
                userId,
                "Default Organization"
            )
            break
        case Role.DELIVERY_STAFF:
            await this.userRepository.createDeliveryStaffProfile(userId)
            break
        default:
        // Admin doesn't need a specific profile
            break
        }
    }

    // Donor Profile operations
    async updateDonorProfile(id: string, updateDonorProfileInput: UpdateDonorProfileInput) {
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

    // Kitchen Staff Profile operations
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
            throw new BadRequestException("Failed to update kitchen staff profile")
        }
    }

    async deleteKitchenStaffProfile(id: string) {
        try {
            return await this.userRepository.deleteKitchenStaffProfile(id)
        } catch (error) {
            throw new BadRequestException("Failed to delete kitchen staff profile")
        }
    }

    // Fundraiser Profile operations
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

    // Delivery Staff Profile operations
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
            throw new BadRequestException("Failed to update delivery staff profile")
        }
    }

    async deleteDeliveryStaffProfile(id: string) {
        try {
            return await this.userRepository.deleteDeliveryStaffProfile(id)
        } catch (error) {
            throw new BadRequestException("Failed to delete delivery staff profile")
        }
    }

    // Search and filter operations
    async searchUsers(searchTerm: string, role?: Role) {
        return this.userRepository.searchUsers(searchTerm, role)
    }

    async getUsersByRole(role: Role) {
        return this.userRepository.getUsersByRole(role)
    }

    async getActiveUsers() {
        return this.userRepository.getActiveUsers()
    }

    // For GraphQL Federation - resolver reference
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.findUserById(reference.id)
    }
}
