import { Injectable } from "@nestjs/common"
import { User } from "../../domain/entities/user.entity"
import { Role } from "../../domain/enums/user.enum"

/**
 * Shared Mapper: User
 * Maps between different user representations
 */
@Injectable()
export class UserMapper {
    /**
     * Map from database model to domain entity
     */
    toDomain(dbUser: any): User {
        return new User(
            dbUser.id,
            dbUser.cognito_id,
            dbUser.email,
            dbUser.user_name,
            dbUser.full_name,
            dbUser.is_active,
            dbUser.role as Role,
            dbUser.avatar_url,
            dbUser.phone_number,
            dbUser.bio,
            dbUser.address,
            dbUser.created_at,
            dbUser.updated_at,
        )
    }

    /**
     * Map from domain entity to database model
     */
    toDatabase(user: User): any {
        return {
            id: user.id,
            cognito_id: user.cognitoId,
            email: user.email,
            user_name: user.username,
            full_name: user.fullName,
            is_active: user.isActive,
            role: user.role,
            avatar_url: user.avatarUrl,
            phone_number: user.phoneNumber,
            bio: user.bio,
            address: user.address,
        }
    }

    /**
     * Map from domain entity to DTO
     */
    toDto(user: User): any {
        return {
            id: user.id,
            cognitoId: user.cognitoId,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            isActive: user.isActive,
            role: user.role,
            avatarUrl: user.avatarUrl,
            phoneNumber: user.phoneNumber,
            bio: user.bio,
            address: user.address,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    }

    /**
     * Map from domain entity to GraphQL model
     */
    toGraphQL(user: User): any {
        return {
            id: user.id,
            email: user.email,
            user_name: user.username,
            full_name: user.fullName,
            is_active: user.isActive,
            role: user.role,
            avatar_url: user.avatarUrl,
            phone_number: user.phoneNumber,
            bio: user.bio,
            address: user.address,
            created_at: user.createdAt,
            updated_at: user.updatedAt,
        }
    }
}
