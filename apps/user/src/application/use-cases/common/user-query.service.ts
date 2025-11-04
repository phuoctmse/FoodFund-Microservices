import { UserProfileSchema } from "../../../domain/entities"
import { UserRepository } from "../../../domain/repositories"
import { Injectable, Logger } from "@nestjs/common"


@Injectable()
export class UserQueryService {
    private readonly logger = new Logger(UserQueryService.name)

    constructor(private readonly userRepository: UserRepository) {}

    async findAllUsers(
        skip?: number,
        take?: number,
    ): Promise<UserProfileSchema[]> {
        this.logger.log(`Finding all users with skip: ${skip}, take: ${take}`)
        return this.userRepository.findAllUsers(skip, take) as any
    }

    async findUserById(id: string): Promise<UserProfileSchema | null> {
        this.logger.log(`Finding user by ID: ${id}`)
        return this.userRepository.findUserById(id) as any
    }

    async findUserByEmail(email: string): Promise<UserProfileSchema | null> {
        this.logger.log(`Finding user by email: ${email}`)
        return this.userRepository.findUserByEmail(email) as any
    }

    async findUserByUsername(
        username: string,
    ): Promise<UserProfileSchema | null> {
        this.logger.log(`Finding user by username: ${username}`)
        return this.userRepository.findUserByUsername(username) as any
    }

    async findUserByCognitoId(
        cognitoId: string,
    ): Promise<UserProfileSchema | null> {
        this.logger.log(`Finding user by Cognito ID: ${cognitoId}`)
        return this.userRepository.findUserByCognitoId(cognitoId) as any
    }

    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<UserProfileSchema | null> {
        this.logger.log(
            `Resolving GraphQL federation reference: ${reference.id}`,
        )
        return this.userRepository.findUserById(reference.id) as any
    }
}
