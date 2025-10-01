import { User } from "@prisma/client"
import { UserProfileSchema } from "@libs/databases/prisma/schemas/models/user-profiles.model"
import { Role } from "@libs/databases/prisma/schemas/enums/user.enums"

/**
 * Map Prisma User entity to GraphQL UserProfileSchema
 * Handles type conversion between Prisma enums and GraphQL enums
 * Converts null values to undefined for GraphQL compatibility
 */
export function mapPrismaUserToGraphQL(
    user: User,
): Omit<UserProfileSchema, "__typename"> {
    return {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url ?? undefined,
        email: user.email,
        phone_number: user.phone_number ?? undefined,
        role: user.role as Role,
        is_active: user.is_active,
        user_name: user.user_name,
        bio: user.bio ?? undefined,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    }
}
