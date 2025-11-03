import {
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common"
import { Role, UserContext } from "../types/user-context.type"

@Injectable()
export class AuthorizationService {
    requireAuthentication(
        userContext: UserContext | null,
        operation: string,
    ): void {
        if (!userContext?.userId) {
            throw new UnauthorizedException(
                `User authentication required to ${operation}`,
            )
        }
    }

    requireRole(
        userContext: UserContext,
        requiredRole: Role,
        operation: string,
    ): void {
        if (userContext.role !== requiredRole) {
            throw new ForbiddenException(
                `Only users with ${requiredRole} role can ${operation}. ` +
                    `Your role: ${userContext.role || "none"}`,
            )
        }
    }

    requireAdmin(userContext: UserContext, operation: string): void {
        this.requireRole(userContext, Role.ADMIN, operation)
    }

    requireOwnership(
        resourceOwnerId: string,
        userContext: UserContext,
        resourceType: string,
        operation: string,
    ): void {
        if (resourceOwnerId !== userContext.userId) {
            throw new ForbiddenException(
                `Only the ${resourceType} creator can ${operation}. This ${resourceType} belongs to another user.`,
            )
        }
    }

    requireOwnerOrAdmin(
        resourceOwnerId: string,
        userContext: UserContext,
        resourceType: string,
        operation: string,
    ): void {
        const isOwner = resourceOwnerId === userContext.userId
        const isAdmin = userContext.role === Role.ADMIN

        if (!isOwner && !isAdmin) {
            throw new ForbiddenException(
                `You don't have permission to ${operation} this ${resourceType}. Only the owner or admin can perform this action.`,
            )
        }
    }

    hasRole(userContext: UserContext, role: Role): boolean {
        return userContext.role === role
    }

    isAdmin(userContext: UserContext): boolean {
        return this.hasRole(userContext, Role.ADMIN)
    }

    isOwner(resourceOwnerId: string, userContext: UserContext): boolean {
        return resourceOwnerId === userContext.userId
    }

    canModify(resourceOwnerId: string, userContext: UserContext): boolean {
        return (
            this.isOwner(resourceOwnerId, userContext) ||
            this.isAdmin(userContext)
        )
    }
}
