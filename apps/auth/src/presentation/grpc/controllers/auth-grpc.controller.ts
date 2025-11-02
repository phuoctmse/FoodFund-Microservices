import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { GrpcServerService } from "libs/grpc"
import { AuthApplicationService } from "../../../application/services/auth-application.service"
import { envConfig } from "libs/env"

/**
 * Presentation Controller: Auth gRPC
 * Handles gRPC requests for auth service
 */
@Injectable()
export class AuthGrpcController implements OnModuleInit {
    private readonly logger = new Logger(AuthGrpcController.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly authApplicationService: AuthApplicationService,
    ) {}

    async onModuleInit() {
        try {
            const env = envConfig()
            // Initialize gRPC server
            await this.grpcServer.initialize({
                port: env.grpc.auth?.port || 50001,
                protoPath: "auth.proto",
                packageName: "foodfund.auth",
                serviceName: "AuthService",
                implementation: this.getImplementation(),
            })

            // Start server
            await this.grpcServer.start()
            this.logger.log(
                `Auth gRPC server started on port ${env.grpc.auth?.port || 50001}`,
            )
        } catch (error) {
            this.logger.error("Failed to start Auth gRPC service:", error)
        }
    }

    private getImplementation() {
        return {
            // Health check (required)
            Health: this.health.bind(this),

            // Auth service methods
            ValidateToken: this.validateToken.bind(this),
            GetUserFromToken: this.getUserFromToken.bind(this),
            RefreshToken: this.refreshToken.bind(this),
            CheckPermission: this.checkPermission.bind(this),
        }
    }

    // Health check implementation
    private async health(call: any, callback: any) {
        const response = {
            status: "healthy",
            service: "auth-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }

        callback(null, response)
    }

    // Validate access token
    private async validateToken(call: any, callback: any) {
        try {
            const { access_token } = call.request

            if (!access_token) {
                callback(null, {
                    valid: false,
                    user: null,
                    error: "Access token is required",
                    expires_at: 0,
                })
                return
            }

            // Validate token using application service
            const user =
                await this.authApplicationService.verifyToken(access_token)

            callback(null, {
                valid: true,
                user: {
                    id: user.id,
                    cognito_id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    provider: user.provider,
                    attributes: {},
                },
                error: null,
                expires_at: Date.now() + 3600000, // 1 hour from now
            })
        } catch (error) {
            this.logger.error("Token validation failed:", error)

            callback(null, {
                valid: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Token validation failed",
                expires_at: 0,
            })
        }
    }

    // Get user info from token
    private async getUserFromToken(call: any, callback: any) {
        try {
            const { access_token } = call.request

            const user =
                await this.authApplicationService.verifyToken(access_token)

            callback(null, {
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
            })
        } catch (error) {
            this.logger.error("Get user from token failed:", error)

            callback(null, {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to get user",
            })
        }
    }

    // Refresh token
    private async refreshToken(call: any, callback: any) {
        try {
            const { refresh_token, user_name } = call.request

            if (!refresh_token || !user_name) {
                callback(null, {
                    success: false,
                    access_token: null,
                    refresh_token: null,
                    expires_in: 0,
                    error: "Refresh token and user name are required",
                })
                return
            }

            const result = await this.authApplicationService.refreshToken(
                refresh_token,
                user_name,
            )

            callback(null, {
                success: true,
                access_token: result.accessToken,
                id_token: result.idToken,
                expires_in: result.expiresIn,
                error: null,
            })
        } catch (error) {
            this.logger.error("Refresh token failed:", error)

            callback(null, {
                success: false,
                access_token: null,
                refresh_token: null,
                expires_in: 0,
                error:
                    error instanceof Error
                        ? error.message
                        : "Refresh token failed",
            })
        }
    }

    // Check user permissions (placeholder - implement based on your RBAC)
    private async checkPermission(call: any, callback: any) {
        try {
            const { user_id, resource, action } = call.request

            // TODO: Implement permission checking logic
            // This is a placeholder implementation

            // For now, allow all actions for demo purposes
            callback(null, {
                allowed: true,
                reason: "Permission granted (demo mode)",
            })
        } catch (error) {
            this.logger.error("Permission check failed:", error)

            callback(null, {
                allowed: false,
                reason: `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            })
        }
    }
}
