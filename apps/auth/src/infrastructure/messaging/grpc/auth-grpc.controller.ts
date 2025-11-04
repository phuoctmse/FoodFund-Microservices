import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import { AuthAuthenticationService } from "../../../application/services"
import { AwsCognitoService } from "libs/aws-cognito"

// Request/Response interfaces matching proto definitions
interface ValidateTokenRequest {
    access_token: string
}

interface ValidateTokenResponse {
    valid: boolean
    user: AuthUser | null
    error: string | null
    expires_at: number
}

interface GetUserFromTokenRequest {
    access_token: string
}

interface GetUserFromTokenResponse {
    success: boolean
    user: AuthUser | null
    error: string | null
}

interface RefreshTokenRequest {
    refresh_token: string
}

interface RefreshTokenResponse {
    success: boolean
    access_token: string | null
    refresh_token: string | null
    expires_in: number
    error: string | null
}

interface CheckPermissionRequest {
    user_id: string
    resource: string
    action: string
}

interface CheckPermissionResponse {
    allowed: boolean
    reason: string
}

interface AuthUser {
    id: string
    cognito_id: string
    email: string
    username: string
    name: string
    provider: string
    roles: string[]
    attributes: Record<string, string>
}

@Controller()
export class AuthGrpcController {
    private readonly logger = new Logger(AuthGrpcController.name)

    constructor(
        private readonly authAuthenticationService: AuthAuthenticationService,
        private readonly cognitoService: AwsCognitoService,
    ) {}

    @GrpcMethod("AuthService", "ValidateToken")
    async validateToken(
        data: ValidateTokenRequest,
    ): Promise<ValidateTokenResponse> {
        try {
            const { access_token } = data

            if (!access_token) {
                return {
                    valid: false,
                    user: null,
                    error: "Access token is required",
                    expires_at: 0,
                }
            }

            // Validate token with Cognito
            const decodedToken =
                await this.cognitoService.validateToken(access_token)

            // Get user details
            const cognitoUser = await this.cognitoService.getUser(access_token)

            const customAttributes = this.cognitoService.extractCustomAttributes(
                cognitoUser.UserAttributes || [],
            )

            // Convert attributes to Record<string, string>
            const attributes: Record<string, string> = {}
            for (const [key, value] of Object.entries(customAttributes)) {
                attributes[key] = String(value)
            }

            const authUser: AuthUser = {
                id: String(decodedToken.sub || ""),
                cognito_id: String(decodedToken.sub || ""),
                email: String(decodedToken.email || ""),
                username: String(decodedToken["cognito:username"] || ""),
                name: String(decodedToken.name || ""),
                provider: "aws-cognito",
                roles: [],
                attributes,
            }

            return {
                valid: true,
                user: authUser,
                error: null,
                expires_at: decodedToken.exp * 1000, // Convert to milliseconds
            }
        } catch (error) {
            this.logger.error("Token validation failed:", error)

            return {
                valid: false,
                user: null,
                error: error.message,
                expires_at: 0,
            }
        }
    }

    @GrpcMethod("AuthService", "GetUserFromToken")
    async getUserFromToken(
        data: GetUserFromTokenRequest,
    ): Promise<GetUserFromTokenResponse> {
        try {
            const { access_token } = data

            const authUser =
                await this.authAuthenticationService.verifyToken(access_token)

            return {
                success: true,
                user: {
                    id: authUser.id,
                    cognito_id: authUser.id,
                    email: authUser.email,
                    username: authUser.username,
                    name: authUser.name,
                    provider: authUser.provider,
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
                error: error.message,
            }
        }
    }

    @GrpcMethod("AuthService", "RefreshToken")
    async refreshToken(
        data: RefreshTokenRequest,
    ): Promise<RefreshTokenResponse> {
        try {
            const { refresh_token } = data

            // TODO: Implement refresh token logic with Cognito
            // This is a placeholder implementation

            return {
                success: false,
                access_token: null,
                refresh_token: null,
                expires_in: 0,
                error: "Refresh token not implemented yet",
            }
        } catch (error) {
            this.logger.error("Refresh token failed:", error)

            return {
                success: false,
                access_token: null,
                refresh_token: null,
                expires_in: 0,
                error: error.message,
            }
        }
    }

    @GrpcMethod("AuthService", "CheckPermission")
    async checkPermission(
        data: CheckPermissionRequest,
    ): Promise<CheckPermissionResponse> {
        try {
            const { user_id, resource, action } = data

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
                reason: `Permission check failed: ${error.message}`,
            }
        }
    }
}
