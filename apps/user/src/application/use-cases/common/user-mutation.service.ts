import { UserProfileSchema } from "../../../domain/entities"
import { UserRepository } from "../../../domain/repositories"
import { Injectable, Logger } from "@nestjs/common"
import { UpdateUserInput } from "../../dtos"

@Injectable()
export class UserMutationService {
    private readonly logger = new Logger(UserMutationService.name)

    constructor(private readonly userRepository: UserRepository) {}

    async updateUser(
        id: string,
        input: UpdateUserInput,
    ): Promise<UserProfileSchema> {
        this.logger.log(`Updating user: ${id}`)
        return this.userRepository.updateUser(id, input) as any
    }

    async deleteUser(id: string): Promise<UserProfileSchema> {
        this.logger.log(`Deleting user: ${id}`)
        return this.userRepository.deleteUser(id) as any
    }

    // Additional general user operations
    async activateUser(id: string): Promise<UserProfileSchema> {
        this.logger.log(`Activating user: ${id}`)
        // Implementation for activating user
        return this.userRepository.findUserById(id) as any
    }

    async deactivateUser(id: string): Promise<UserProfileSchema> {
        this.logger.log(`Deactivating user: ${id}`)
        // Implementation for deactivating user
        return this.userRepository.findUserById(id) as any
    }
}
