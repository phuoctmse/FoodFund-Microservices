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
    AdminCreateUserCommand,
    AdminConfirmSignUpCommand,
    AuthFlowType,
    AdminDeleteUserCommand,
    GlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoJwtVerifier } from "aws-jwt-verify"
import { createHmac } from "crypto"
import { envConfig } from "../env"
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

    constructor(
        @Inject(MODULE_OPTIONS_TOKEN)
        private readonly options: AwsCognitoModuleOptions,
    ) {
        const config = envConfig().aws

        if (!config) {
            throw new Error("AWS configuration not found in environment")
        }

        // Use options if provided, otherwise fall back to env config
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
                    : undefined, // Use default credentials if not provided
        })

        // JWT verifier will be created when needed

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
                const errorMessage =
                    flowError instanceof Error
                        ? flowError.message
                        : String(flowError)
                this.logger.debug(
                    `Auth flow ${authFlow} failed: ${errorMessage}`,
                )

                // If this is not an auth flow configuration error, rethrow immediately
                if (!this.isAuthFlowConfigError(flowError)) {
                    throw flowError
                }

                // Continue to next auth flow if available
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

            this.logger.debug(command)

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
     * Validate Cognito access token
     */
    async validateToken(token: string) {
        try {
            // Create JWT verifier on demand
            const jwtVerifier = CognitoJwtVerifier.create({
                userPoolId: this.userPoolId,
                tokenUse: "access",
                clientId: this.clientId,
            })

            const payload = await jwtVerifier.verify(token)
            this.logger.debug(`Token validated for user: ${payload.sub}`)
            return payload
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            this.logger.error(`Token validation failed: ${errorMessage}`)
            throw new UnauthorizedException("Invalid AWS Cognito token")
        }
    }

    /**
     * Get user details using access token
     */
    async getUser(accessToken: string) {
        try {
            const command = new GetUserCommand({
                AccessToken: accessToken,
            })

            const response = await this.cognitoClient.send(command)
            this.logger.debug(`User retrieved: ${response.Username}`)
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
            this.logger.debug(`Admin user retrieved: ${username}`)
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
            this.logger.error("adminDeleteUser: Email is required and must be a string")
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

            await this.cognitoClient.send(command)
            this.logger.log(`Admin confirmed user: ${email}`)

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
}
