import { Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import { GrpcClientService } from "libs/grpc"
import { SentryService } from "libs/observability"
import { generateUniqueUsername, SagaOrchestrator } from "libs/common"
import { envConfig } from "@libs/env"
import { randomBytes } from "node:crypto"
import {
    SignUpInput,
    ConfirmSignUpInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
    SignInInput,
    RefreshTokenInput,
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../dto"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    SignInResponse,
    SignOutResponse,
    RefreshTokenResponse,
    AuthUser,
    AuthResponse,
    CheckPasswordResponse,
    GoogleAuthResponse,
} from "../models"
import { AuthErrorHelper } from "../helpers"
import { CognitoMapperHelper } from "../helpers/cognito-mapper.helper"
import { Role } from "../enum/role.enum"

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClient: GrpcClientService,
        private readonly sentryService: SentryService,
        private readonly cognitoMapper: CognitoMapperHelper,
    ) {}

    // ============================================
    // REGISTRATION METHODS
    // ============================================

    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        const username = generateUniqueUsername(input.email)
        let cognitoUserSub: string | null = null

        const saga = new SagaOrchestrator(`User Registration: ${input.email}`, {
            logger: this.logger,
            onCompensationFailed: (stepName, error) => {
                this.sentryService.captureError(
                    new Error(
                        `CRITICAL: Saga compensation failed for ${stepName}`,
                    ),
                    {
                        compensationError: {
                            message:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                            stack:
                                error instanceof Error
                                    ? error.stack
                                    : undefined,
                        },
                        userContext: {
                            email: input.email,
                            cognitoUserSub,
                            timestamp: new Date().toISOString(),
                            severity: "CRITICAL",
                            action: "MANUAL_CLEANUP_REQUIRED",
                            service: "auth-service",
                            operation: "user-registration-rollback",
                        },
                        tags: {
                            severity: "critical",
                            operation: "saga-rollback",
                            service: "auth-service",
                            requiresManualIntervention: "true",
                        },
                    },
                )

                this.sentryService.captureMessage(
                    `🚨 CRITICAL: Manual cleanup required for user registration ${input.email}`,
                    "error",
                    {
                        alertType: "manual-intervention-required",
                        priority: "P1",
                        email: input.email,
                        cognitoUserSub,
                    },
                )
            },
        })

        try {
            // Step 1: Create Cognito user
            saga.addStep({
                name: "Create Cognito User",
                execute: async () => {
                    const result = await this.awsCognitoService.signUp(
                        input.email,
                        input.password,
                        {
                            name: input.name,
                            "custom:role": Role.DONOR,
                        },
                    )
                    cognitoUserSub = result.userSub || ""
                    return result
                },
                compensate: async () => {
                    if (cognitoUserSub) {
                        await this.awsCognitoService.adminDeleteUser(
                            input.email,
                        )
                    }
                },
            })

            // Step 2: Create user profile in User Service
            saga.addStep({
                name: "Create User Profile",
                execute: async () => {
                    const userResult = await this.grpcClient.callUserService(
                        "CreateUser",
                        {
                            cognito_id: cognitoUserSub,
                            email: input.email,
                            username: username,
                            full_name: input.name,
                            role: Role.DONOR,
                        },
                    )

                    if (!userResult.success) {
                        throw new Error(
                            `User Service failed: ${userResult.error || "Unknown error"}`,
                        )
                    }

                    return userResult
                },
            })

            await saga.execute()

            return {
                userSub: cognitoUserSub!,
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            }
        } catch (error) {
            throw AuthErrorHelper.mapCognitoError(error, "signUp", input.email)
        }
    }

    async confirmSignUp(
        input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        try {
            this.logger.log(`Confirming sign up for email: ${input.email}`)

            await this.awsCognitoService.confirmSignUp(
                input.email,
                input.confirmationCode,
            )

            this.logger.log(
                `Sign up confirmed successfully for: ${input.email}`,
            )

            return {
                confirmed: true,
                message: "Email confirmed successfully. You can now sign in.",
            }
        } catch (error) {
            this.logger.error(
                `Confirm sign up failed for ${input.email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "confirmSignUp",
                input.email,
            )
        }
    }

    async resendConfirmationCode(email: string): Promise<ResendCodeResponse> {
        try {
            this.logger.log(`Resending confirmation code for: ${email}`)

            await this.awsCognitoService.resendConfirmationCode(email)

            this.logger.log(
                `Confirmation code resent successfully for: ${email}`,
            )

            return {
                emailSent: true,
                message: "Confirmation code sent to your email",
            }
        } catch (error) {
            this.logger.error(
                `Resend confirmation code failed for ${email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "resendConfirmationCode",
                email,
            )
        }
    }

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        try {
            this.logger.log(`Initiating forgot password for: ${email}`)

            await this.awsCognitoService.forgotPassword(email)

            this.logger.log(
                `Forgot password initiated successfully for: ${email}`,
            )

            return {
                emailSent: true,
                message: "Password reset code sent to your email",
            }
        } catch (error) {
            this.logger.error(`Forgot password failed for ${email}:`, error)
            throw AuthErrorHelper.mapCognitoError(
                error,
                "forgotPassword",
                email,
            )
        }
    }

    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ): Promise<ResetPasswordResponse> {
        try {
            this.logger.log(`Confirming forgot password for: ${email}`)

            await this.awsCognitoService.confirmForgotPassword(
                email,
                confirmationCode,
                newPassword,
            )

            this.logger.log(`Password reset successfully for: ${email}`)

            return {
                passwordReset: true,
                message:
                    "Password reset successful. You can now sign in with your new password.",
            }
        } catch (error) {
            this.logger.error(
                `Confirm forgot password failed for ${email}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(
                error,
                "confirmForgotPassword",
                email,
            )
        }
    }

    // ============================================
    // AUTHENTICATION METHODS
    // ============================================

    async signIn(input: SignInInput): Promise<SignInResponse> {
        try {
            this.logger.log(`Attempting to sign in user: ${input.email}`)

            const result = await this.awsCognitoService.signIn(
                input.email,
                input.password,
            )

            const userOutput = await this.awsCognitoService.getUser(
                result.AccessToken!,
            )
            const cognitoUser = this.cognitoMapper.fromGetUserOutput(userOutput)

            await this.validateUserIsActive(cognitoUser.sub)

            this.logger.log(`User signed in successfully: ${cognitoUser.sub}`)

            return {
                user: this.cognitoMapper.toAuthUser(cognitoUser),
                accessToken: result.AccessToken!,
                refreshToken: result.RefreshToken!,
                idToken: result.IdToken!,
                expiresIn: result.ExpiresIn!,
                message: "Sign in successful",
            }
        } catch (error) {
            this.logger.error(`Sign in failed for ${input.email}:`, error)
            throw AuthErrorHelper.mapCognitoError(error, "signIn", input.email)
        }
    }

    async signOut(accessToken: string): Promise<SignOutResponse> {
        try {
            this.logger.log("Processing sign out request")

            const result = await this.awsCognitoService.signOut(accessToken)

            this.logger.log("User signed out successfully")

            return {
                success: result.success,
                message: "User signed out successfully",
                timestamp: new Date().toISOString(),
            }
        } catch (error) {
            this.logger.error("Sign out failed:", error)
            throw AuthErrorHelper.mapCognitoError(error, "signOut")
        }
    }

    async verifyToken(accessToken: string): Promise<AuthUser> {
        try {
            this.logger.log("Verifying access token")

            const userOutput = await this.awsCognitoService.getUser(accessToken)
            const cognitoUser =
                this.cognitoMapper.fromGetUserOutput(userOutput)
            const user = this.cognitoMapper.toAuthUser(cognitoUser)

            this.logger.log(`Token verified successfully for user: ${user.id}`)

            return user
        } catch (error) {
            this.logger.error("Token verification failed:", error)
            throw AuthErrorHelper.mapCognitoError(error, "verifyToken")
        }
    }

    async refreshToken(
        input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        try {
            this.logger.log(`Refreshing token for user: ${input.userName}`)

            const result = await this.awsCognitoService.refreshToken(
                input.refreshToken,
                input.userName,
            )

            this.logger.log(
                `Token refreshed successfully for: ${input.userName}`,
            )

            return {
                accessToken: result.AccessToken!,
                idToken: result.IdToken!,
                expiresIn: result.ExpiresIn!,
                message: "Token refreshed successfully",
            }
        } catch (error) {
            this.logger.error(
                `Token refresh failed for ${input.userName}:`,
                error,
            )
            throw AuthErrorHelper.mapCognitoError(error, "refreshToken")
        }
    }

    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return {
            user,
            message: "User validated successfully",
        }
    }

    // ============================================
    // USER PROFILE METHODS
    // ============================================

    async getUserById(id: string): Promise<AuthUser | null> {
        try {
            this.logger.log(`Getting user by ID: ${id}`)

            const userOutput =
                await this.awsCognitoService.getUserByUsername(id)
            if (!userOutput) {
                return null
            }

            const cognitoUser =
                this.cognitoMapper.fromAdminGetUserOutput(userOutput)
            const user = this.cognitoMapper.toAuthUser(cognitoUser)

            this.logger.log(`User retrieved successfully: ${user.id}`)

            return user
        } catch (error) {
            this.logger.error(`Get user by ID failed for ${id}:`, error)
            throw AuthErrorHelper.mapCognitoError(error, "getUserById")
        }
    }

    async changePassword(
        id: string,
        input: ChangePasswordInput,
    ): Promise<boolean> {
        if (input.newPassword !== input.confirmNewPassword) {
            throw new Error(
                "New password and confirm new password do not match",
            )
        }
        try {
            await this.awsCognitoService.changePassword(id, input.newPassword)
            return true
        } catch (error) {
            this.logger.error(`Change password failed for ${id}:`, error)
            throw AuthErrorHelper.mapCognitoError(error, "changePassword")
        }
    }

    async checkCurrentPassword(
        userId: string,
        input: CheckCurrentPasswordInput,
    ): Promise<CheckPasswordResponse> {
        try {
            this.logger.log(`Checking current password for user: ${userId}`)

            await this.awsCognitoService.signIn(userId, input.currentPassword)

            return {
                isValid: true,
                message: "Password is valid",
            }
        } catch (error) {
            this.logger.error(
                `Error checking password for user ${userId}:`,
                error,
            )
            return {
                isValid: false,
                message: "Invalid password",
            }
        }
    }

    async googleAuthentication(
        input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        try {
            this.logger.log("Processing Google authentication with AWS Cognito")

            const googleUserInfo = await this.verifyGoogleIdToken(input.idToken)

            if (!googleUserInfo) {
                throw new Error("Invalid Google ID token")
            }

            this.logger.log(`Google user verified: ${googleUserInfo.email}`)

            const { cognitoUser, isNewUser, userPassword } =
                await this.findOrCreateCognitoUser(googleUserInfo)

            const authResult = await this.generateAuthTokens(
                cognitoUser,
                isNewUser,
                userPassword,
            )

            return this.buildGoogleAuthResponse(
                cognitoUser,
                authResult,
                isNewUser,
            )
        } catch (error) {
            this.logger.error("Error in Google authentication:", error)
            throw new Error(`Google authentication failed: ${error.message}`)
        }
    }

    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================

    private async validateUserIsActive(cognitoId: string): Promise<void> {
        try {
            this.logger.log(`Checking if user is active: ${cognitoId}`)

            const userResponse = await this.grpcClient.callUserService(
                "GetUser",
                { cognito_id: cognitoId },
            )

            if (!userResponse.success) {
                this.logger.warn(`User not found in User Service: ${cognitoId}`)
                throw new UnauthorizedException(
                    "User account not found. Please contact support.",
                )
            }

            if (!userResponse.user.is_active) {
                this.logger.warn(
                    `User account is inactive: ${cognitoId} (${userResponse.user.email})`,
                )
                throw new UnauthorizedException(
                    "Your account has been deactivated. Please contact support for assistance.",
                )
            }

            this.logger.log(`User is active: ${cognitoId}`)
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error
            }

            this.logger.error(
                `Failed to validate user active status: ${error instanceof Error ? error.message : error}`,
            )
            throw new UnauthorizedException("Unable to verify account status.")
        }
    }

    private async verifyGoogleIdToken(idToken: string): Promise<any> {
        try {
            const response = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
            )

            if (!response.ok) {
                throw new Error("Failed to verify Google ID token")
            }

            const tokenInfo = await response.json()

            if (tokenInfo.error) {
                throw new Error(`Invalid Google token: ${tokenInfo.error}`)
            }

            const expectedAudience = envConfig().google.clientId
            if (expectedAudience && tokenInfo.aud !== expectedAudience) {
                throw new Error("Invalid token audience")
            }

            return {
                sub: tokenInfo.sub,
                email: tokenInfo.email,
                name: tokenInfo.name,
                picture: tokenInfo.picture,
                email_verified: tokenInfo.email_verified === "true",
            }
        } catch (error) {
            this.logger.error("Error verifying Google ID token:", error)
            throw new Error("Invalid Google ID token")
        }
    }

    private async findOrCreateCognitoUser(googleUserInfo: any): Promise<{
        cognitoUser: CognitoUser
        isNewUser: boolean
        userPassword?: string
    }> {
        let cognitoUser: CognitoUser | null = null
        let isNewUser = false
        let userPassword: string | undefined

        try {
            const existingUserOutput =
                await this.awsCognitoService.getUserByUsername(
                    googleUserInfo.email,
                )
            if (existingUserOutput) {
                cognitoUser = this.cognitoMapper.fromAdminGetUserOutput(
                    existingUserOutput,
                )
                this.logger.log(`Existing user found: ${cognitoUser.email}`)
            }
        } catch (error) {
            this.logger.log(
                `User not found, will create new user: ${googleUserInfo.email}`,
            )
            isNewUser = true
        }

        if (!cognitoUser) {
            const result = await this.createNewGoogleUser(googleUserInfo)
            cognitoUser = result.cognitoUser
            userPassword = result.userPassword
            isNewUser = true
        }

        return { cognitoUser: cognitoUser!, isNewUser, userPassword }
    }

    private async createNewGoogleUser(googleUserInfo: any): Promise<{
        cognitoUser: CognitoUser
        userPassword: string
    }> {
        const secureRandomSuffix = randomBytes(16).toString("hex")
        const securePassword = `GoogleUser!${Date.now()}.${secureRandomSuffix}`

        await this.awsCognitoService.signUp(
            googleUserInfo.email,
            securePassword,
            {
                name: googleUserInfo.name || googleUserInfo.email,
                email: googleUserInfo.email,
                "custom:role": Role.DONOR,
            },
        )

        await this.awsCognitoService.adminConfirmSignUp(googleUserInfo.email)

        const createdUserOutput =
            await this.awsCognitoService.getUserByUsername(googleUserInfo.email)
        const cognitoUser = this.cognitoMapper.fromAdminGetUserOutput(
            createdUserOutput,
        )

        this.logger.log(
            `New Google user created in Cognito: ${cognitoUser.email}`,
        )

        await this.createUserInDatabase(cognitoUser, googleUserInfo)

        return { cognitoUser, userPassword: securePassword }
    }

    private async createUserInDatabase(
        cognitoUser: CognitoUser,
        googleUserInfo: any,
    ): Promise<void> {
        try {
            const createUserResult =
                await this.grpcClient.callUserService("CreateUser", {
                    cognito_id: cognitoUser.sub,
                    email: cognitoUser.email,
                    full_name: cognitoUser.name,
                    cognito_attributes: {
                        avatar_url: googleUserInfo.picture || "",
                        bio: "",
                    },
                })

            if (!createUserResult.success) {
                throw new Error(
                    `Failed to create user in database: ${createUserResult.error}`,
                )
            }

            this.logger.log(
                `User created in database successfully: ${cognitoUser.email}`,
            )
        } catch (error) {
            this.logger.error("Error creating user in database:", error)
            await this.cleanupCognitoUser(cognitoUser.email)
            throw new Error(
                `Failed to create user in database: ${error.message}`,
            )
        }
    }

    private async cleanupCognitoUser(email: string): Promise<void> {
        try {
            await this.awsCognitoService.adminDeleteUser(email)
        } catch (cleanupError) {
            this.logger.error("Failed to cleanup Cognito user:", cleanupError)
        }
    }

    private async generateAuthTokens(
        cognitoUser: CognitoUser,
        isNewUser: boolean,
        userPassword?: string,
    ): Promise<{
        AccessToken: string
        RefreshToken: string
        IdToken: string
    }> {
        try {
            const tokenResult =
                isNewUser && userPassword
                    ? await this.awsCognitoService.generateTokensForOAuthUser(
                        cognitoUser.username,
                        userPassword,
                    )
                    : await this.awsCognitoService.generateTokensForOAuthUser(
                        cognitoUser.username,
                    )

            this.logger.log(
                `JWT tokens generated successfully for user: ${cognitoUser.email}`,
            )

            return {
                AccessToken: tokenResult.AccessToken!,
                RefreshToken: tokenResult.RefreshToken!,
                IdToken: tokenResult.IdToken!,
            }
        } catch (error) {
            this.logger.error(
                "Failed to generate JWT tokens from Cognito:",
                error,
            )
            throw new Error(
                `Failed to generate authentication tokens: ${error.message}`,
            )
        }
    }

    private buildGoogleAuthResponse(
        cognitoUser: CognitoUser,
        authResult: any,
        isNewUser: boolean,
    ): GoogleAuthResponse {
        const authUser = this.cognitoMapper.toAuthUser(cognitoUser)
        authUser.provider = "Google"

        const response: GoogleAuthResponse = {
            user: authUser,
            accessToken: authResult.AccessToken,
            refreshToken: authResult.RefreshToken,
            idToken: authResult.IdToken,
            isNewUser,
            message: isNewUser
                ? "User created and authenticated successfully with Google"
                : "User authenticated successfully with Google",
        }

        this.logger.log(
            `Google authentication successful for user: ${authUser.email}`,
        )
        return response
    }
}
