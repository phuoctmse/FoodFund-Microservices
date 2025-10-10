import { SetMetadata, UseGuards, applyDecorators } from "@nestjs/common"
import { Role } from "libs/databases/prisma/schemas/enums/user.enums"
import { RoleGuard } from "../guards/role.guard"

/**
 * Decorator that requires specific role(s) authentication for GraphQL resolvers
 * Uses RoleGuard to verify token and check user role
 *
 * @param roles - Single role or array of roles that are allowed to access the endpoint
 *
 * @example
 * // Single role
 * @RequireRole(Role.ADMIN)
 *
 * // Multiple roles
 * @RequireRole([Role.ADMIN, Role.KITCHEN_STAFF])
 *
 * // Or multiple arguments
 * @RequireRole(Role.ADMIN, Role.KITCHEN_STAFF)
 */
export const RequireRole = (...roles: Role[]) => {
    const flatRoles = roles.flat()
    return applyDecorators(
        SetMetadata("roles", flatRoles),
        UseGuards(RoleGuard),
    )
}
