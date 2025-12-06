import {
    Injectable,
    Logger,
    UnauthorizedException,
    Inject,
} from "@nestjs/common"
import {
    CognitoIdentityProviderClient,
    GetUserCommand,
    AdminGetUserCommand,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    AdminInitiateAuthCommand,
    ResendConfirmationCodeCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    AdminConfirmSignUpCommand,
    AuthFlowType,
    AdminDeleteUserCommand,
    GlobalSignOutCommand,
    AdminSetUserPasswordCommand,
    AdminUpdateUserAttributesCommand,
    AdminDisableUserCommand,
    AdminEnableUserCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { createHmac, randomBytes, createHash } from "node:crypto"
import { envConfig } from "../env"
import { RedisService } from "@libs/redis"
import { MODULE_OPTIONS_TOKEN } from "./aws-cognito.module-definition"
import {
    AwsCognitoModuleOptions,
    CognitoUserAttribute,
    AuthenticationResult,
    SignUpResponse,
    ConfirmationResponse,
    ResendCodeResponse,
    PasswordResetResponse,
} from "./aws-cognito.types"

@Injectable()
export class AwsCognitoService {
    private readonly logger = new Logger(AwsCognitoService.name)
    private readonly cognitoClient: CognitoIdentityProviderClient
    private readonly userPoolId: string
    private readonly clientId: string
    private readonly clientSecret?: string

    // Cache TTL: 50 minutes (shorter than 60 min token expiration)
    private readonly CACHE_TTL_SECONDS = 50 * 60

    constructor(
        @Inject(MODULE_OPTIONS_TOKEN)
        private readonly options: AwsCognitoModuleOptions,
        private readonly redisService: RedisService,
    ) {
        const config = envConfig().aws

        if (!config) {
            throw new Error("AWS configuration not found in environment")
        }

        this.userPoolId = this.options.userPoolId || config.cognito.userPoolId
        this.clientId = this.options.clientId || config.cognito.clientId
        this.clientSecret =
            this.options.clientSecret || config.cognito.clientSecret
        const region = this.options.region || config.cognito.region

        if (!this.userPoolId) {
            throw new Error(
                "AWS Cognito User Pool ID is required. Please set AWS_COGNITO_USER_POOL_ID environment variable or provide it in module options.",
            )
        }

        if (!this.clientId) {
            throw new Error(
                "AWS Cognito Client ID is required. Please set AWS_COGNITO_CLIENT_ID environment variable or provide it in module options.",
            )
        }

        if (!region) {
            throw new Error(
                "AWS Region is required. Please set AWS_REGION environment variable or provide it in module options.",
            )
        }

        this.cognitoClient = new CognitoIdentityProviderClient({
            region: region,
            credentials:
                config.accessKeyId && config.secretAccessKey
                    ? {
                        accessKeyId: config.accessKeyId,
                        secretAccessKey: config.secretAccessKey,
                    }
                    : undefined,
        })

        this.logger.log(
            `AWS Cognito Service initialized for region: ${region}, User Pool: ${this.userPoolId}`,
        )
    }

    /**
     * Calculate SECRET_HASH for Cognito operations
     */
    private calculateSecretHash(username: string): string | undefined {
        if (!this.clientSecret) {
            return undefined
        }

        const message = username + this.clientId
        return createHmac("sha256", this.clientSecret)
            .update(message)
            .digest("base64")
    }

    private generateCacheKey(token: string, prefix: string): string {
        // Create SHA-256 hash of token (first 24 chars for shorter keys)
        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex")
            .substring(0, 24)

        return `${prefix}:${tokenHash}`
    }

    async signUp(
        email: string,
        password: string,
        attributes?: Record<string, string>,
    ) {
        try {
            const userAttributes = [
                { Name: "email", Value: email },
                ...(attributes
                    ? Object.entries(attributes).map(([key, value]) => ({
                        Name: key,
                        Value: value,
                    }))
                    : []),
            ]

            const secretHash = this.calculateSecretHash(email)
            const command = new SignUpCommand({
                ClientId: this.clientId,
                Username: email,
                Password: password,
                UserAttributes: userAttributes,
                ...(secretHash && { SecretHash: secretHash }),
            })

            const response = await this.cognitoClient.send(command)
            this.logger.log(`User signed up: ${email}`)

            return {
                userSub: response.UserSub,
                codeDeliveryDetails: response.CodeDeliveryDetails,
                userConfirmed: response.UserConfirmed,
            } as SignUpResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Sign up failed: ${errorMessage}`)
            throw new UnauthorizedException(`Sign up failed: ${errorMessage}`)
        }
    }

    async confirmSignUp(email: string, confirmationCode: string) {
        try {
            const secretHash = this.calculateSecretHash(email)
            const command = new ConfirmSignUpCommand({
                ClientId: this.clientId,
                Username: email,
                ConfirmationCode: confirmationCode,
                ...(secretHash && { SecretHash: secretHash }),
            })

            await this.cognitoClient.send(command)
            this.logger.log(`User confirmed: ${email}`)

            return { confirmed: true } as ConfirmationResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Confirmation failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Confirmation failed: ${errorMessage}`,
            )
        }
    }

    async signIn(email: string, password: string) {
        try {
            this.logger.log(`Attempting sign in for user: ${email}`)

            // Prepare authentication parameters
            const authParameters = this.prepareAuthParameters(email, password)

            // Attempt authentication with available flows
            const authResult = await this.attemptAuthentication(authParameters)

            this.logger.log(`User signed in successfully: ${email}`)

            return this.formatAuthResponse(authResult)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Sign in failed for ${email}: ${errorMessage}`)
            throw new UnauthorizedException(
                `Authentication failed: ${errorMessage}`,
            )
        }
    }

    private prepareAuthParameters(
        email: string,
        password: string,
    ): Record<string, string> {
        const authParameters: Record<string, string> = {
            USERNAME: email,
            PASSWORD: password,
        }

        const secretHash = this.calculateSecretHash(email)
        if (secretHash) {
            authParameters.SECRET_HASH = secretHash
        }

        return authParameters
    }

    private async attemptAuthentication(
        authParameters: Record<string, string>,
    ) {
        const authFlows = [AuthFlowType.ADMIN_NO_SRP_AUTH]

        for (const authFlow of authFlows) {
            try {
                const response = await this.executeAuthFlow(
                    authFlow,
                    authParameters,
                )

                if (response.AuthenticationResult) {
                    return response.AuthenticationResult
                }

                throw new Error("Authentication result is missing")
            } catch (flowError: unknown) {
                if (!this.isAuthFlowConfigError(flowError)) {
                    throw flowError
                }
                continue
            }
        }

        throw new Error(
            "All authentication flows failed. Please check your Cognito User Pool Client configuration.",
        )
    }

    private async executeAuthFlow(
        authFlow: AuthFlowType,
        authParameters: Record<string, string>,
    ) {
        if (authFlow === AuthFlowType.ADMIN_NO_SRP_AUTH) {
            const command = new AdminInitiateAuthCommand({
                UserPoolId: this.userPoolId,
                ClientId: this.clientId,
                AuthFlow: authFlow,
                AuthParameters: authParameters,
            })
            return await this.cognitoClient.send(command)
        } else {
            const command = new InitiateAuthCommand({
                ClientId: this.clientId,
                AuthFlow: authFlow,
                AuthParameters: authParameters,
            })
            return await this.cognitoClient.send(command)
        }
    }

    private isAuthFlowConfigError(error: unknown): boolean {
        const errorMessage =
            error instanceof Error ? error.message : String(error)
        return (
            errorMessage?.includes("Auth flow not enabled") ||
            errorMessage?.includes("not supported")
        )
    }

    private formatAuthResponse(
        authResult: AuthenticationResult,
    ): AuthenticationResult {
        return {
            AccessToken: authResult.AccessToken,
            RefreshToken: authResult.RefreshToken,
            IdToken: authResult.IdToken,
            ExpiresIn: authResult.ExpiresIn,
            TokenType: authResult.TokenType,
        }
    }

    async resendConfirmationCode(email: string) {
        try {
            const secretHash = this.calculateSecretHash(email)
            const command = new ResendConfirmationCodeCommand({
                ClientId: this.clientId,
                Username: email,
                ...(secretHash && { SecretHash: secretHash }),
            })

            const response = await this.cognitoClient.send(command)

            return {
                codeDeliveryDetails: response.CodeDeliveryDetails,
            } as ResendCodeResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Resend code failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Resend code failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Forgot Password
     */
    async forgotPassword(email: string) {
        try {
            const secretHash = this.calculateSecretHash(email)
            const command = new ForgotPasswordCommand({
                ClientId: this.clientId,
                Username: email,
                ...(secretHash && { SecretHash: secretHash }),
            })

            const response = await this.cognitoClient.send(command)

            return {
                codeDeliveryDetails: response.CodeDeliveryDetails,
            } as ResendCodeResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Forgot password failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Forgot password failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Confirm Forgot Password
     */
    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ) {
        try {
            const secretHash = this.calculateSecretHash(email)
            const command = new ConfirmForgotPasswordCommand({
                ClientId: this.clientId,
                Username: email,
                ConfirmationCode: confirmationCode,
                Password: newPassword,
                ...(secretHash && { SecretHash: secretHash }),
            })
            await this.cognitoClient.send(command)

            return { passwordReset: true } as PasswordResetResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            if (
                error?.name === "CodeMismatchException" ||
                errorMessage.includes("Invalid verification code")
            ) {
                this.logger.warn(`Wrong confirmation code for ${email}`)
                throw new UnauthorizedException(
                    "Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại email và mã xác nhận.",
                )
            }
            this.logger.error(`Password reset failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Password reset failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Validate Cognito access token (with caching)
     */
    async validateToken(token: string) {
        try {
            // 1. Check cache first
            const cacheKey = this.generateCacheKey(token, "cognito:token")
            const cachedPayload = await this.redisService.get(cacheKey)

            if (cachedPayload) {
                return JSON.parse(cachedPayload)
            }

            // 2. Validate with AWS Cognito (cache miss)
            const jwtVerifier = CognitoJwtVerifier.create({
                userPoolId: this.userPoolId,
                tokenUse: "access",
                clientId: this.clientId,
            })

            const payload = await jwtVerifier.verify(token)

            // 3. Cache the result (50 minutes TTL)
            await this.redisService.set(cacheKey, JSON.stringify(payload), {
                ex: this.CACHE_TTL_SECONDS,
            })
            return payload
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Token validation failed: ${errorMessage}`)
            throw new UnauthorizedException("Invalid AWS Cognito token")
        }
    }

    /**
     * Get user details using access token (with caching)
     */
    async getUser(accessToken: string) {
        try {
            // 1. Check cache first
            const cacheKey = this.generateCacheKey(accessToken, "cognito:user")
            const cachedUser = await this.redisService.get(cacheKey)

            if (cachedUser) {
                return JSON.parse(cachedUser)
            }

            // 2. Get from AWS Cognito (cache miss)
            const command = new GetUserCommand({
                AccessToken: accessToken,
            })

            const response = await this.cognitoClient.send(command)

            // 3. Cache the result (50 minutes TTL)
            await this.redisService.set(cacheKey, JSON.stringify(response), {
                ex: this.CACHE_TTL_SECONDS,
            })

            return response
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Failed to get user: ${errorMessage}`)
            throw new UnauthorizedException("User not found or token invalid")
        }
    }

    /**
     * Get user by username (admin operation)
     */
    async getUserByUsername(username: string) {
        try {
            const command = new AdminGetUserCommand({
                UserPoolId: this.userPoolId,
                Username: username,
            })

            const response = await this.cognitoClient.send(command)
            return response
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Failed to get user by username: ${errorMessage}`)
            throw new UnauthorizedException("User not found")
        }
    }

    async adminDeleteUser(email: string): Promise<{ deleted: boolean }> {
        if (!email || typeof email !== "string") {
            this.logger.error(
                "adminDeleteUser: Email is required and must be a string",
            )
            throw new UnauthorizedException("Email is required to delete user")
        }

        try {
            const command = new AdminDeleteUserCommand({
                UserPoolId: this.userPoolId,
                Username: email,
            })

            await this.cognitoClient.send(command)
            this.logger.log(`Admin deleted user: ${email}`)

            return { deleted: true }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Admin delete user failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Admin delete user failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Disable user account in Cognito
     * Prevents user from signing in
     */
    async adminDisableUser(email: string): Promise<{ disabled: boolean }> {
        if (!email || typeof email !== "string") {
            this.logger.error(
                "adminDisableUser: Email is required and must be a string",
            )
            throw new UnauthorizedException("Email is required to disable user")
        }

        try {
            const command = new AdminDisableUserCommand({
                UserPoolId: this.userPoolId,
                Username: email,
            })

            await this.cognitoClient.send(command)
            this.logger.log(`Admin disabled user: ${email}`)

            return { disabled: true }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Admin disable user failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Admin disable user failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Enable user account in Cognito
     * Allows user to sign in again
     */
    async adminEnableUser(email: string): Promise<{ enabled: boolean }> {
        if (!email || typeof email !== "string") {
            this.logger.error(
                "adminEnableUser: Email is required and must be a string",
            )
            throw new UnauthorizedException("Email is required to enable user")
        }

        try {
            const command = new AdminEnableUserCommand({
                UserPoolId: this.userPoolId,
                Username: email,
            })

            await this.cognitoClient.send(command)
            this.logger.log(`Admin enabled user: ${email}`)

            return { enabled: true }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Admin enable user failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Admin enable user failed: ${errorMessage}`,
            )
        }
    }

    extractCustomAttributes(
        attributes: CognitoUserAttribute[],
    ): Record<string, string> {
        const customAttrs: Record<string, string> = {}
        attributes?.forEach((attr) => {
            if (attr.Name && attr.Value && attr.Name.startsWith("custom:")) {
                customAttrs[attr.Name.replace("custom:", "")] = attr.Value
            }
        })
        return customAttrs
    }

    getAttributeValue(
        attributes: CognitoUserAttribute[],
        attributeName: string,
    ): string | undefined {
        return attributes?.find((attr) => attr.Name === attributeName)?.Value
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string, userName: string) {
        try {
            const authParameters: Record<string, string> = {
                REFRESH_TOKEN: refreshToken,
            }

            const secretHash = this.calculateSecretHash(userName)
            if (secretHash) {
                authParameters.SECRET_HASH = secretHash
            }

            const command = new InitiateAuthCommand({
                ClientId: this.clientId,
                AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
                AuthParameters: authParameters,
            })

            const response = await this.cognitoClient.send(command)

            if (!response.AuthenticationResult) {
                throw new Error("Authentication result is missing")
            }

            this.logger.log("Token refreshed successfully")

            return this.formatAuthResponse(response.AuthenticationResult)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Token refresh failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Token refresh failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Admin confirm sign up (bypass email confirmation)
     */
    async adminConfirmSignUp(email: string) {
        try {
            const command = new AdminConfirmSignUpCommand({
                UserPoolId: this.userPoolId,
                Username: email,
            })

            // Run confirmation and email verification in parallel
            await Promise.all([
                this.cognitoClient.send(command),
                this.updateUserAttributes(email, {
                    email_verified: "true",
                }),
            ])

            this.logger.log(`Admin confirmed user and verified email: ${email}`)

            return { confirmed: true } as ConfirmationResponse
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Admin confirmation failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Admin confirmation failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Sign out user globally from all devices
     */
    async signOut(accessToken: string): Promise<{ success: boolean }> {
        try {
            this.logger.log("Signing out user globally")

            const command = new GlobalSignOutCommand({
                AccessToken: accessToken,
            })

            await this.cognitoClient.send(command)
            this.logger.log("User signed out successfully")

            return { success: true }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Sign out failed: ${errorMessage}`)
            throw new UnauthorizedException(`Sign out failed: ${errorMessage}`)
        }
    }

    // Update user attributes (stub)
    async updateUserAttributes(
        username: string,
        attributes: Record<string, string>,
    ) {
        try {
            const userAttributes = Object.entries(attributes).map(
                ([key, value]) => ({
                    Name: key,
                    Value: value,
                }),
            )
            const command = new AdminUpdateUserAttributesCommand({
                UserPoolId: this.userPoolId,
                Username: username,
                UserAttributes: userAttributes,
            })
            await this.cognitoClient.send(command)
            this.logger.log(`Updated attributes for user: ${username}`)
            return true
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Update user attributes failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Update user attributes failed: ${errorMessage}`,
            )
        }
    }

    async changePassword(username: string, newPassword: string) {
        try {
            const command = new AdminSetUserPasswordCommand({
                UserPoolId: this.userPoolId,
                Username: username,
                Password: newPassword,
                Permanent: true,
            })
            await this.cognitoClient.send(command)
            this.logger.log(`Changed password for user: ${username}`)
            return true
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Change password failed: ${errorMessage}`)
            throw new UnauthorizedException(
                `Change password failed: ${errorMessage}`,
            )
        }
    }

    /**
     * Generate authentication tokens for a user (for OAuth flows)
     * This uses AdminInitiateAuth with ADMIN_NO_SRP_AUTH to generate JWT tokens
     */
    async generateTokensForOAuthUser(
        username: string,
        password?: string,
    ): Promise<AuthenticationResult> {
        try {
            this.logger.log(`Generating tokens for OAuth user: ${username}`)

            // Use ADMIN_NO_SRP_AUTH flow to generate tokens
            const secretHash = this.calculateSecretHash(username)

            const authParameters: Record<string, string> = {
                USERNAME: username,
            }

            // Add password if provided, otherwise try without password first
            if (password) {
                authParameters.PASSWORD = password
            }

            if (secretHash) {
                authParameters.SECRET_HASH = secretHash
            }

            const command = new AdminInitiateAuthCommand({
                UserPoolId: this.userPoolId,
                ClientId: this.clientId,
                AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
                AuthParameters: authParameters,
            })

            const response = await this.cognitoClient.send(command)

            if (!response.AuthenticationResult) {
                throw new Error(
                    "No authentication result returned from Cognito",
                )
            }

            this.logger.log(
                `Tokens generated successfully for OAuth user: ${username}`,
            )

            return this.formatAuthResponse(response.AuthenticationResult)
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(
                `Generate tokens for OAuth user failed: ${errorMessage}`,
            )

            // If ADMIN_NO_SRP_AUTH fails, try alternative approach with temporary password
            try {
                return await this.generateTokensWithTemporaryPassword(username)
            } catch (fallbackError) {
                this.logger.error(
                    `Fallback token generation also failed: ${fallbackError}`,
                )
                throw new UnauthorizedException(
                    `Token generation failed: ${errorMessage}`,
                )
            }
        }
    }

    /**
     * Fallback method to generate tokens using temporary password
     */
    private async generateTokensWithTemporaryPassword(
        username: string,
    ): Promise<AuthenticationResult> {
        this.logger.log(
            `Using fallback method with temporary password for user: ${username}`,
        )

        // Set a temporary password
        const tempPassword = `TempPass!${Date.now()}`
        await this.changePassword(username, tempPassword)

        // Authenticate with the temporary password
        const secretHash = this.calculateSecretHash(username)

        const authParameters: Record<string, string> = {
            USERNAME: username,
            PASSWORD: tempPassword,
        }

        if (secretHash) {
            authParameters.SECRET_HASH = secretHash
        }

        const command = new AdminInitiateAuthCommand({
            UserPoolId: this.userPoolId,
            ClientId: this.clientId,
            AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
            AuthParameters: authParameters,
        })

        const response = await this.cognitoClient.send(command)

        if (!response.AuthenticationResult) {
            throw new Error("No authentication result returned from Cognito")
        }

        // Immediately change password to a new secure one to invalidate the temporary password
        const secureRandomSuffix = randomBytes(16).toString("hex")
        const newSecurePassword = `GoogleOAuth!${Date.now()}.${secureRandomSuffix}`
        await this.changePassword(username, newSecurePassword)

        this.logger.log(
            `Tokens generated successfully using fallback method for user: ${username}`,
        )

        return this.formatAuthResponse(response.AuthenticationResult)
    }
}
