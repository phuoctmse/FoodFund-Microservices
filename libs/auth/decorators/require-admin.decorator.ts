import { UseGuards } from "@nestjs/common"
import { AdminGuard } from "../guards/admin.guard"

/**
 * Decorator that requires admin authentication for GraphQL resolvers
 * Uses AdminGuard to verify token and check admin role
 */
export const RequireAdmin = () => UseGuards(AdminGuard)