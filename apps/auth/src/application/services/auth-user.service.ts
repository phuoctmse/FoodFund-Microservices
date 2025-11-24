import { Injectable, Logger } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import { AdminGetUserCommandOutput } from "@aws-sdk/client-cognito-identity-provider"
import {
    AuthUser,
    AuthResponse,
    CheckPasswordResponse,
    GoogleAuthResponse,
} from "../../domain/entities"
import { AuthErrorHelper } from "../../shared/helpers"
import { randomBytes } from "node:crypto"

import {
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../dtos/auth.input"
import { GrpcClientService } from "libs/grpc"
import { envConfig } from "@libs/env"
import { Role } from "../../domain/enums/role.enum"

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        private readonly grpcClientService: GrpcClientService,
    ) {}

    async getUserById(id: string): Promise<AuthUser | null> {
        try {
            this.logger.log(`Getting user by ID: ${id}`)

            const userOutput =
                await this.awsCognitoService.getUserByUsername(id)
            if (!userOutput) {
                return null
            }

            const cognitoUser =
                this.convertAdminGetUserOutputToCognitoUser(userOutput)
            const user = this.mapCognitoUserToAuthUser(cognitoUser)

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

    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return {
            user,
            message: "User validated successfully",
        }
    }

    private convertAdminGetUserOutputToCognitoUser(
        output: AdminGetUserCommandOutput,
    ): CognitoUser {
        const attributes = output.UserAttributes || []
        const getAttr = (name: string) =>
            attributes.find((attr) => attr.Name === name)?.Value || ""

        return {
            sub: output.Username || "",
            email: getAttr("email"),
            emailVerified: getAttr("email_verified") === "true",
            username: output.Username || "",
            name: getAttr("name"),
            phoneNumber: getAttr("phone_number"),
            provider: "cognito",
            cognitoUser: output,
            createdAt: output.UserCreateDate,
            updatedAt: output.UserLastModifiedDate,
        }
    }

    private mapCognitoUserToAuthUser(cognitoUser: CognitoUser): AuthUser {
        return {
            id: cognitoUser.sub,
            email: cognitoUser.email,
            username: cognitoUser.username,
            name: cognitoUser.name,
            phoneNumber: cognitoUser.phoneNumber || "",
            emailVerified: cognitoUser.emailVerified,
            provider: cognitoUser.provider,
            createdAt: cognitoUser.createdAt || new Date(),
            updatedAt: cognitoUser.updatedAt || new Date(),
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

    // Helper method: Find or create Cognito user
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
                cognitoUser =
                    this.convertAdminGetUserOutputToCognitoUser(
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

        return { cognitoUser, isNewUser, userPassword }
    }

    // Helper method: Create new Google user
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
        const cognitoUser =
            this.convertAdminGetUserOutputToCognitoUser(createdUserOutput)

        this.logger.log(
            `New Google user created in Cognito: ${cognitoUser.email}`,
        )

        await this.createUserInDatabase(cognitoUser, googleUserInfo)

        return { cognitoUser, userPassword: securePassword }
    }

    // Helper method: Create user in database
    private async createUserInDatabase(
        cognitoUser: CognitoUser,
        googleUserInfo: any,
    ): Promise<void> {
        try {
            const createUserResult =
                await this.grpcClientService.callUserService("CreateUser", {
                    cognitoId: cognitoUser.sub,
                    email: cognitoUser.email,
                    fullName: cognitoUser.name,
                    cognitoAttributes: {
                        avatarUrl: googleUserInfo.picture || "",
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

    // Helper method: Cleanup Cognito user on failure
    private async cleanupCognitoUser(email: string): Promise<void> {
        try {
            await this.awsCognitoService.adminDeleteUser(email)
        } catch (cleanupError) {
            this.logger.error("Failed to cleanup Cognito user:", cleanupError)
        }
    }

    // Helper method: Generate authentication tokens
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

    // Helper method: Build Google auth response
    private buildGoogleAuthResponse(
        cognitoUser: CognitoUser,
        authResult: any,
        isNewUser: boolean,
    ): GoogleAuthResponse {
        const authUser = this.mapCognitoUserToAuthUser(cognitoUser)
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

    // Helper method: Verify Google ID token
    private async verifyGoogleIdToken(idToken: string): Promise<any> {
        try {
            const response = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
            )

            if (!response.ok) {
                throw new Error("Failed to verify Google ID token")
            }

            const tokenInfo = await response.json()

            // Verify token is valid and not expired
            if (tokenInfo.error) {
                throw new Error(`Invalid Google token: ${tokenInfo.error}`)
            }

            // Verify audience (your Google Client ID)
            // You should add your Google Client ID to environment variables
            const expectedAudience = envConfig().google.clientId
            if (expectedAudience && tokenInfo.aud !== expectedAudience) {
                throw new Error("Invalid token audience")
            }

            return {
                sub: tokenInfo.sub, // Google user ID
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
}
