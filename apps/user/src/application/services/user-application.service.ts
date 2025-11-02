import { Injectable, Logger, Inject } from "@nestjs/common"
import { IUserRepository } from "../../domain/interfaces"
import {
    UserNotFoundException,
    UserInactiveException,
} from "../../domain/exceptions"
import { UserMapper } from "../../shared/mappers"
import { Role } from "../../domain/enums"

/**
 * Application Service: User
 * Contains business logic for user operations
 */
@Injectable()
export class UserApplicationService {
    private readonly logger = new Logger(UserApplicationService.name)

    constructor(
        @Inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        private readonly userMapper: UserMapper,
    ) {}

    // ============================================
    // Query Operations
    // ============================================

    async getUserById(id: string) {
        this.logger.log(`Getting user by ID: ${id}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        return this.userMapper.toDto(user)
    }

    async getUserByCognitoId(cognitoId: string) {
        this.logger.log(`Getting user by Cognito ID: ${cognitoId}`)

        const user = await this.userRepository.findByCognitoId(cognitoId)
        if (!user) {
            throw new UserNotFoundException(cognitoId)
        }

        return this.userMapper.toDto(user)
    }

    async getUserByEmail(email: string) {
        this.logger.log(`Getting user by email: ${email}`)

        const user = await this.userRepository.findByEmail(email)
        if (!user) {
            throw new UserNotFoundException(email)
        }

        return this.userMapper.toDto(user)
    }

    async getUserByUsername(username: string) {
        this.logger.log(`Getting user by username: ${username}`)

        const user = await this.userRepository.findByUsername(username)
        if (!user) {
            throw new UserNotFoundException(username)
        }

        return this.userMapper.toDto(user)
    }

    async getAllUsers(skip?: number, take?: number) {
        this.logger.log(`Getting all users with skip: ${skip}, take: ${take}`)

        const users = await this.userRepository.findAll(skip, take)
        return users.map((user) => this.userMapper.toDto(user))
    }

    // ============================================
    // Mutation Operations
    // ============================================

    async createUser(data: {
        cognitoId: string
        email: string
        username: string
        fullName: string
        role?: Role
    }) {
        this.logger.log(`Creating user: ${data.email}`)

        // Check if user already exists
        const existingUser = await this.userRepository.findByCognitoId(
            data.cognitoId,
        )
        if (existingUser) {
            this.logger.warn(
                `User with Cognito ID ${data.cognitoId} already exists`,
            )
            return this.userMapper.toDto(existingUser)
        }

        // Create new user
        const user = await this.userRepository.create({
            cognitoId: data.cognitoId,
            email: data.email,
            username: data.username,
            fullName: data.fullName,
            role: data.role || Role.DONOR,
            isActive: true,
        })

        this.logger.log(`User created successfully: ${user.id}`)
        return this.userMapper.toDto(user)
    }

    async updateUser(id: string, data: any) {
        this.logger.log(`Updating user: ${id}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        // Business rule: Only active users can be updated
        if (!user.isActive) {
            throw new UserInactiveException(id)
        }

        const updated = await this.userRepository.update(id, data)
        return this.userMapper.toDto(updated)
    }

    async deleteUser(id: string) {
        this.logger.log(`Deleting user: ${id}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        const deleted = await this.userRepository.delete(id)
        return this.userMapper.toDto(deleted)
    }

    async activateUser(id: string) {
        this.logger.log(`Activating user: ${id}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        // Use domain logic
        user.activate()

        const updated = await this.userRepository.update(id, {
            isActive: user.isActive,
        })

        return this.userMapper.toDto(updated)
    }

    async deactivateUser(id: string) {
        this.logger.log(`Deactivating user: ${id}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        // Use domain logic
        user.deactivate()

        const updated = await this.userRepository.update(id, {
            isActive: user.isActive,
        })

        return this.userMapper.toDto(updated)
    }

    async updateUserRole(id: string, role: Role) {
        this.logger.log(`Updating user role: ${id} to ${role}`)

        const user = await this.userRepository.findById(id)
        if (!user) {
            throw new UserNotFoundException(id)
        }

        const updated = await this.userRepository.updateRole(id, role)
        return this.userMapper.toDto(updated)
    }

    // ============================================
    // Business Logic
    // ============================================

    async getUsersByRole(role: Role) {
        this.logger.log(`Getting users by role: ${role}`)

        const users = await this.userRepository.findUsersByRole(role)
        return users.map((user) => this.userMapper.toDto(user))
    }

    async getActiveUsers() {
        this.logger.log("Getting active users")

        const users = await this.userRepository.findActiveUsers()
        return users.map((user) => this.userMapper.toDto(user))
    }
}
