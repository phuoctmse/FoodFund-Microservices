import {
    Injectable,
    ConflictException,
    BadRequestException,
} from "@nestjs/common"
import {
    UserRepository,
    CreateUserInput,
    CreateStaffUserInput,
} from "../user.repository"
import { Role } from "libs/databases/prisma/schemas"
import { ProfileService } from "./profile.service"
import { generateUniqueUsername } from "libs/common"

@Injectable()
export class UserCreationService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly profileService: ProfileService,
    ) {}

    async createUser(createUserInput: CreateUserInput) {
        try {
            // Check if email already exists
            const existingEmailUser = await this.userRepository.findUserByEmail(
                createUserInput.email,
            )
            if (existingEmailUser) {
                throw new ConflictException("Email already exists")
            }

            // Ensure unique username
            const uniqueUsername = await this.ensureUniqueUsername(
                createUserInput.user_name,
                createUserInput.email,
            )

            const user = await this.userRepository.createUser({
                ...createUserInput,
                user_name: uniqueUsername,
            })

            // Automatically create corresponding profile based on role
            await this.profileService.createProfileForUser(
                user.id,
                user.role as Role,
                createUserInput.cognito_attributes,
            )

            return await this.userRepository.findUserById(user.id)
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error
            }
            throw new BadRequestException("Failed to create user")
        }
    }

    async createStaffUser(createStaffUserInput: CreateStaffUserInput) {
        try {
            // Check if email already exists
            const existingEmailUser = await this.userRepository.findUserByEmail(
                createStaffUserInput.email,
            )
            if (existingEmailUser) {
                throw new ConflictException("Email already exists")
            }

            // Ensure unique username
            const uniqueUsername = await this.ensureUniqueUsername(
                createStaffUserInput.user_name,
                createStaffUserInput.email,
            )

            const user = await this.userRepository.createStaffUser({
                ...createStaffUserInput,
                user_name: uniqueUsername,
            })

            // Create role-specific profile with staff-specific data
            await this.profileService.createStaffProfileForUser(
                user.id,
                user.role as Role,
                createStaffUserInput,
            )

            return await this.userRepository.findUserById(user.id)
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error
            }
            throw new BadRequestException("Failed to create staff user")
        }
    }

    /**
     * Ensure username is unique by checking database and generating alternatives if needed
     */
    private async ensureUniqueUsername(
        proposedUsername: string,
        email: string,
    ): Promise<string> {
        // If no username provided, generate from email
        if (!proposedUsername) {
            proposedUsername = generateUniqueUsername(email)
        }

        // Check if proposed username is available
        const existingUser =
            await this.userRepository.findUserByUsername(proposedUsername)
        if (!existingUser) {
            return proposedUsername
        }

        // Get all existing usernames to avoid conflicts
        const existingUsernames = await this.getAllExistingUsernames()

        // Generate unique username
        return generateUniqueUsername(email, existingUsernames)
    }

    /**
     * Get all existing usernames from database (for uniqueness check)
     */
    private async getAllExistingUsernames(): Promise<string[]> {
        try {
            // This is a simplified approach - in production you might want to optimize this
            const users = await this.userRepository.findAllUsers(0, 10000) // Get first 10k users
            return users.map((user) => user.user_name).filter(Boolean)
        } catch (error) {
            // If we can't get existing usernames, return empty array
            // The generateUniqueUsername will still work with random fallback
            return []
        }
    }
}
