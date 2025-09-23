import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { GrpcServerService } from "libs/grpc"
import { AuthService } from "../auth.service"
import { AwsCognitoService } from "libs/aws-cognito"
import { envConfig } from "libs/env"

@Injectable()
export class AuthGrpcService implements OnModuleInit {
    private readonly logger = new Logger(AuthGrpcService.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly authService: AuthService,
        private readonly cognitoService: AwsCognitoService,
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

            // Validate token with Cognito
            const decodedToken =
                await this.cognitoService.validateToken(access_token)

            // Get user details
            const cognitoUser = await this.cognitoService.getUser(access_token)

            const authUser = {
                id: decodedToken.sub,
                cognito_id: decodedToken.sub,
                email: decodedToken.email || "",
                username: decodedToken["cognito:username"] || "",
                name: decodedToken.name || "",
                provider: "aws-cognito",
                attributes: this.cognitoService.extractCustomAttributes(
                    cognitoUser.UserAttributes || [],
                ),
            }

            callback(null, {
                valid: true,
                user: authUser,
                error: null,
                expires_at: decodedToken.exp * 1000, // Convert to milliseconds
            })
        } catch (error) {
            this.logger.error("Token validation failed:", error)

            callback(null, {
                valid: false,
                user: null,
                error: error.message,
                expires_at: 0,
            })
        }
    }

    // Get user info from token
    private async getUserFromToken(call: any, callback: any) {
        try {
            const { access_token } = call.request

            const authUser = await this.authService.verifyToken(access_token)

            callback(null, {
                success: true,
                user: {
                    id: authUser.id,
                    cognito_id: authUser.id,
                    email: authUser.email,
                    username: authUser.username,
                    name: authUser.name,
                    provider: authUser.provider,
                    roles: [], // Add roles if available
                    attributes: {}, // Add custom attributes if needed
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Get user from token failed:", error)

            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }

    // Refresh token (placeholder - implement based on your needs)
    private async refreshToken(call: any, callback: any) {
        try {
            const { refresh_token } = call.request

            // TODO: Implement refresh token logic with Cognito
            // This is a placeholder implementation

            callback(null, {
                success: false,
                access_token: null,
                refresh_token: null,
                expires_in: 0,
                error: "Refresh token not implemented yet",
            })
        } catch (error) {
            this.logger.error("Refresh token failed:", error)

            callback(null, {
                success: false,
                access_token: null,
                refresh_token: null,
                expires_in: 0,
                error: error.message,
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
                reason: `Permission check failed: ${error.message}`,
            })
        }
    }
}
