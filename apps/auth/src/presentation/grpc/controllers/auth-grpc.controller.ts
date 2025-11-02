import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import { AuthApplicationService } from "../../../application/services/auth-application.service"
import {
    ValidateTokenRequest,
    ValidateTokenResponse,
    GetUserFromTokenRequest,
    GetUserFromTokenResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    CheckPermissionRequest,
    CheckPermissionResponse,
} from "libs/grpc/interfaces/auth-grpc.interface"

/**
 * Presentation Controller: Auth gRPC
 * Handles gRPC requests for auth service using NestJS Microservices
 */
@Controller()
export class AuthGrpcController {
    private readonly logger = new Logger(AuthGrpcController.name)

    constructor(
        private readonly authApplicationService: AuthApplicationService,
    ) {}

    @GrpcMethod("AuthService", "ValidateToken")
    async validateToken(
        data: ValidateTokenRequest,
    ): Promise<ValidateTokenResponse> {
        try {
            this.logger.log("gRPC ValidateToken called")

            if (!data.access_token) {
                return {
                    valid: false,
                    user: null,
                    error: "Access token is required",
                    expires_at: 0,
                }
            }

            const user = await this.authApplicationService.verifyToken(
                data.access_token,
            )

            return {
                valid: true,
                user: {
                    id: user.id,
                    cognito_id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    provider: user.provider,
                    roles: [],
                    attributes: {},
                },
                error: null,
                expires_at: Date.now() + 3600000, // 1 hour from now
            }
        } catch (error) {
            this.logger.error("Token validation failed:", error)
            return {
                valid: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Token validation failed",
                expires_at: 0,
            }
        }
    }

    @GrpcMethod("AuthService", "GetUserFromToken")
    async getUserFromToken(
        data: GetUserFromTokenRequest,
    ): Promise<GetUserFromTokenResponse> {
        try {
            this.logger.log("gRPC GetUserFromToken called")

            if (!data.access_token) {
                return {
                    success: false,
                    user: null,
                    error: "Access token is required",
                }
            }

            const user = await this.authApplicationService.verifyToken(
                data.access_token,
            )

            return {
                success: true,
                user: {
                    id: user.id,
                    cognito_id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    provider: user.provider,
                    roles: [],
                    attributes: {},
                },
                error: null,
            }
        } catch (error) {
            this.logger.error("Get user from token failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to get user",
            }
        }
    }

    @GrpcMethod("AuthService", "RefreshToken")
    async refreshToken(
        data: RefreshTokenRequest,
    ): Promise<RefreshTokenResponse> {
        try {
            this.logger.log("gRPC RefreshToken called")

            if (!data.refresh_token) {
                return {
                    success: false,
                    access_token: "",
                    refresh_token: "",
                    expires_in: 0,
                    error: "Refresh token is required",
                }
            }

            // Note: refreshToken method needs username parameter
            // This is a limitation - we need to pass username in the request
            // For now, return error asking for username
            return {
                success: false,
                access_token: "",
                refresh_token: "",
                expires_in: 0,
                error: "Username is required for token refresh. Please use the GraphQL mutation instead.",
            }
        } catch (error) {
            this.logger.error("Refresh token failed:", error)
            return {
                success: false,
                access_token: "",
                refresh_token: "",
                expires_in: 0,
                error:
                    error instanceof Error
                        ? error.message
                        : "Refresh token failed",
            }
        }
    }

    @GrpcMethod("AuthService", "CheckPermission")
    async checkPermission(
        data: CheckPermissionRequest,
    ): Promise<CheckPermissionResponse> {
        try {
            this.logger.log(
                `gRPC CheckPermission: ${data.user_id} - ${data.resource} - ${data.action}`,
            )

            // TODO: Implement permission checking logic
            // This is a placeholder implementation

            // For now, allow all actions for demo purposes
            return {
                allowed: true,
                reason: "Permission granted (demo mode)",
            }
        } catch (error) {
            this.logger.error("Permission check failed:", error)
            return {
                allowed: false,
                reason: `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            }
        }
    }
}
