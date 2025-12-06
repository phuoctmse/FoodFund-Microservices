import { SetMetadata, UseGuards, applyDecorators } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { RoleGuard } from "../guards/role.guard"
import { Role } from "@libs/databases"

/**
 * Decorator that requires specific role(s) authentication for GraphQL resolvers
 * Uses CognitoGraphQLGuard to verify JWT token and RoleGuard to check user role
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
        UseGuards(CognitoGraphQLGuard, RoleGuard),
    )
}
