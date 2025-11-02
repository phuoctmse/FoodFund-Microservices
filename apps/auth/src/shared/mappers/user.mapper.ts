import { Injectable } from "@nestjs/common"
import { User } from "../../domain/entities/user.entity"

/**
 * Shared Mapper: User
 * Maps between different user representations
 */
@Injectable()
export class UserMapper {
    toDomain(providerUser: {
        sub: string
        email: string
        emailVerified: boolean
        username: string
        name: string
    }): User {
        return new User(
            providerUser.sub,
            providerUser.email,
            providerUser.username,
            providerUser.name,
            true, // isActive - will be validated separately
            providerUser.emailVerified,
            "cognito",
            new Date(),
            new Date(),
        )
    }

    toGraphQL(user: User) {
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            emailVerified: user.emailVerified,
            provider: user.provider,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    }
}
