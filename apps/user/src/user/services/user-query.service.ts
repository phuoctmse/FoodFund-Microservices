import {
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { UserRepository } from "../user.repository"
import { Role } from "libs/databases/prisma/schemas"

@Injectable()
export class UserQueryService {
    constructor(private readonly userRepository: UserRepository) {}

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

    async findUserByCognitoId(cognito_id: string) {
        return this.userRepository.findUserByCognitoId(cognito_id)
    }

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