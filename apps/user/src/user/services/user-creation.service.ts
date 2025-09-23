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

            // Check if username already exists
            const existingUsernameUser =
                await this.userRepository.findUserByUsername(
                    createUserInput.user_name,
                )
            if (existingUsernameUser) {
                throw new ConflictException("Username already exists")
            }

            const user = await this.userRepository.createUser(createUserInput)

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

            // Check if username already exists
            const existingUsernameUser =
                await this.userRepository.findUserByUsername(
                    createStaffUserInput.user_name,
                )
            if (existingUsernameUser) {
                throw new ConflictException("Username already exists")
            }

            const user =
                await this.userRepository.createStaffUser(createStaffUserInput)

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
}
