import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import { AuthenticationService } from "../../application/services"
import { AwsCognitoService } from "libs/aws-cognito"

// Request/Response interfaces matching proto definitions
interface ValidateTokenRequest {
    accessToken: string // camelCase for JavaScript
}

interface ValidateTokenResponse {
    valid: boolean
    user: AuthUser | null
    error: string | null
    expiresAt: number // camelCase
}

interface GetUserFromTokenRequest {
    accessToken: string // camelCase
}

interface GetUserFromTokenResponse {
    success: boolean
    user: AuthUser | null
    error: string | null
}

interface RefreshTokenRequest {
    refreshToken: string
    userName?: string // Optional: can be extracted from token
}

interface RefreshTokenResponse {
    success: boolean
    accessToken: string | null
    refreshToken: string | null
    expiresIn: number
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
    cognitoId: string // camelCase
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
        private readonly authenticationService: AuthenticationService,
        private readonly cognitoService: AwsCognitoService,
    ) {}

    @GrpcMethod("AuthService", "ValidateToken")
    async validateToken(
        data: ValidateTokenRequest,
    ): Promise<ValidateTokenResponse> {
        try {
            const { accessToken } = data

            if (!accessToken) {
                return {
                    valid: false,
                    user: null,
                    error: "Access token is required",
                    expiresAt: 0, // camelCase
                }
            }

            // Validate token with Cognito
            const decodedToken =
                await this.cognitoService.validateToken(accessToken)

            // Get user details
            const cognitoUser = await this.cognitoService.getUser(accessToken)

            const customAttributes =
                this.cognitoService.extractCustomAttributes(
                    cognitoUser.UserAttributes || [],
                )

            // Convert attributes to Record<string, string>
            const attributes: Record<string, string> = {}
            for (const [key, value] of Object.entries(customAttributes)) {
                attributes[key] = String(value)
            }

            const authUser: AuthUser = {
                id: String(decodedToken.sub || ""),
                cognitoId: String(decodedToken.sub || ""),
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
                expiresAt: decodedToken.exp * 1000, // Convert to milliseconds (camelCase)
            }
        } catch (error) {
            this.logger.error("Token validation failed:", error)

            return {
                valid: false,
                user: null,
                error: error.message,
                expiresAt: 0, // camelCase
            }
        }
    }

    @GrpcMethod("AuthService", "GetUserFromToken")
    async getUserFromToken(
        data: GetUserFromTokenRequest,
    ): Promise<GetUserFromTokenResponse> {
        try {
            const { accessToken } = data

            const authUser =
                await this.authenticationService.verifyToken(accessToken)

            return {
                success: true,
                user: {
                    id: authUser.id,
                    cognitoId: authUser.id,
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
            const { refreshToken } = data

            if (!refreshToken) {
                return {
                    success: false,
                    accessToken: null,
                    refreshToken: null,
                    expiresIn: 0,
                    error: "Refresh token is required",
                }
            }

            // Decode refresh token to get username (without verification)
            const decodedToken =
                this.decodeTokenWithoutVerification(refreshToken)
            const userName =
                decodedToken["cognito:username"] || decodedToken.username

            if (!userName) {
                return {
                    success: false,
                    accessToken: null,
                    refreshToken: null,
                    expiresIn: 0,
                    error: "Unable to extract username from refresh token",
                }
            }

            // Call AWS Cognito to refresh token
            const result = await this.cognitoService.refreshToken(
                refreshToken,
                userName,
            )

            this.logger.log(
                `Token refreshed successfully for user: ${userName}`,
            )

            return {
                success: true,
                accessToken: result.AccessToken || null,
                refreshToken: result.RefreshToken || refreshToken, // Return new or original
                expiresIn: result.ExpiresIn || 3600,
                error: null,
            }
        } catch (error) {
            this.logger.error("Refresh token failed:", error)

            return {
                success: false,
                accessToken: null,
                refreshToken: null,
                expiresIn: 0,
                error: error.message || "Token refresh failed",
            }
        }
    }

    /**
     * Decode JWT token without verification (for extracting username)
     * Note: This is safe because we're only reading the payload, not trusting it
     * The actual verification happens in Cognito's refreshToken call
     */
    private decodeTokenWithoutVerification(token: string): any {
        try {
            const parts = token.split(".")
            if (parts.length !== 3) {
                throw new Error("Invalid token format")
            }

            const payload = parts[1]
            const decoded = Buffer.from(payload, "base64").toString("utf-8")
            return JSON.parse(decoded)
        } catch (error) {
            this.logger.error("Failed to decode token:", error)
            return {}
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
