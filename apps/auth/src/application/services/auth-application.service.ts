import { Injectable, Logger, UnauthorizedException, Inject } from "@nestjs/common"
import { IAuthProvider } from "../../domain/interfaces/auth-provider.interface"
import { IUserService } from "../../domain/interfaces/user-service.interface"
import { User } from "../../domain/entities/user.entity"
import { UserInactiveException } from "../../domain/exceptions/user-inactive.exception"
import { SignInDto, SignInResponseDto } from "../dtos/sign-in.dto"
import { SignUpDto, SignUpResponseDto } from "../dtos/sign-up.dto"
import { UserMapper } from "../../shared/mappers"
import { generateUniqueUsername } from "libs/common"

/**
 * Application Service: Auth
 * Contains business logic and orchestrates domain + infrastructure
 */
@Injectable()
export class AuthApplicationService {
    private readonly logger = new Logger(AuthApplicationService.name)

    constructor(
        @Inject("IAuthProvider")
        private readonly authProvider: IAuthProvider, // Infrastructure
        @Inject("IUserService")
        private readonly userService: IUserService, // Infrastructure
        private readonly userMapper: UserMapper, // Shared
    ) {}

    async signIn(dto: SignInDto): Promise<SignInResponseDto> {
        try {
            this.logger.log(`Sign in attempt for: ${dto.email}`)

            // 1. Authenticate with provider
            const authResult = await this.authProvider.signIn(
                dto.email,
                dto.password,
            )

            // 2. Get user details
            const providerUser = await this.authProvider.getUser(
                authResult.accessToken,
            )

            // 3. Map to domain entity
            const user = this.userMapper.toDomain(providerUser)

            // 4. Validate user status (business rule)
            await this.validateUserStatus(user)

            // 5. Return response
            return {
                accessToken: authResult.accessToken,
                refreshToken: authResult.refreshToken,
                idToken: authResult.idToken,
                expiresIn: authResult.expiresIn,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    emailVerified: user.emailVerified,
                    provider: user.provider,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
                message: "Sign in successful",
            }
        } catch (error) {
            this.logger.error(`Sign in failed for ${dto.email}:`, error)
            throw error
        }
    }

    private async validateUserStatus(user: User): Promise<void> {
        // Get user from User Service
        const userServiceResult = await this.userService.getUser(user.id)

        if (!userServiceResult.success) {
            throw new UnauthorizedException("User not found in system")
        }

        // Check if user is active (business rule)
        if (!userServiceResult.user?.isActive) {
            throw new UserInactiveException(user.email)
        }

        this.logger.log(`User ${user.id} validated successfully`)
    }

    async signOut(accessToken: string): Promise<{ success: boolean }> {
        return this.authProvider.signOut(accessToken)
    }

    async verifyToken(accessToken: string): Promise<User> {
        const providerUser = await this.authProvider.getUser(accessToken)
        return this.userMapper.toDomain(providerUser)
    }

    async confirmSignUp(email: string, code: string): Promise<void> {
        await this.authProvider.confirmSignUp(email, code)
    }

    async forgotPassword(email: string): Promise<void> {
        await this.authProvider.forgotPassword(email)
    }

    async confirmForgotPassword(
        email: string,
        code: string,
        newPassword: string,
    ): Promise<void> {
        await this.authProvider.confirmForgotPassword(email, code, newPassword)
    }

    async signUp(dto: SignUpDto): Promise<SignUpResponseDto> {
        try {
            this.logger.log(`Sign up attempt for: ${dto.email}`)

            // 1. Generate username
            const username = generateUniqueUsername(dto.email)

            // 2. Create user in auth provider
            const result = await this.authProvider.signUp(
                dto.email,
                dto.password,
                {
                    name: dto.name,
                    "custom:role": "DONOR",
                },
            )

            // 3. Create user in User Service
            const userServiceResult = await this.userService.createUser({
                cognitoId: result.userSub,
                email: dto.email,
                username,
                fullName: dto.name,
                role: "DONOR",
            })

            if (!userServiceResult.success) {
                // Rollback: Delete from auth provider
                this.logger.error(
                    `Failed to create user in User Service: ${userServiceResult.error}`,
                )
                throw new Error(
                    `User Service failed: ${userServiceResult.error || "Unknown error"}`,
                )
            }

            this.logger.log(`User signed up successfully: ${result.userSub}`)

            return {
                userSub: result.userSub,
                message:
                    "User registered successfully. Please check your email for verification code.",
                emailSent: true,
            }
        } catch (error) {
            this.logger.error(`Sign up failed for ${dto.email}:`, error)
            throw error
        }
    }

    async resendConfirmationCode(email: string): Promise<{
        emailSent: boolean
        message: string
    }> {
        try {
            this.logger.log(`Resending confirmation code for: ${email}`)
            await this.authProvider.resendConfirmationCode(email)
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
            throw error
        }
    }

    async refreshToken(
        refreshToken: string,
        userName: string,
    ): Promise<{
        accessToken: string
        idToken: string
        expiresIn: number
        message: string
    }> {
        try {
            this.logger.log(`Refreshing token for user: ${userName}`)
            const result = await this.authProvider.refreshToken(
                refreshToken,
                userName,
            )
            this.logger.log(`Token refreshed successfully for: ${userName}`)
            return {
                accessToken: result.accessToken,
                idToken: result.idToken,
                expiresIn: result.expiresIn,
                message: "Token refreshed successfully",
            }
        } catch (error) {
            this.logger.error(`Token refresh failed for ${userName}:`, error)
            throw error
        }
    }

    async getUserById(id: string): Promise<User | null> {
        try {
            this.logger.log(`Getting user by ID: ${id}`)
            const providerUser = await this.authProvider.getUserByUsername(id)
            if (!providerUser) return null

            const user = this.userMapper.toDomain(providerUser)
            this.logger.log(`User retrieved successfully: ${user.id}`)
            return user
        } catch (error) {
            this.logger.error(`Get user by ID failed for ${id}:`, error)
            throw error
        }
    }

    async changePassword(
        userId: string,
        newPassword: string,
        confirmNewPassword: string,
    ): Promise<boolean> {
        if (newPassword !== confirmNewPassword) {
            throw new Error(
                "New password and confirm new password do not match",
            )
        }
        try {
            this.logger.log(`Changing password for user: ${userId}`)
            await this.authProvider.changePassword(userId, newPassword)
            this.logger.log(`Password changed successfully for: ${userId}`)
            return true
        } catch (error) {
            this.logger.error(`Change password failed for ${userId}:`, error)
            throw error
        }
    }

    async checkCurrentPassword(
        userId: string,
        currentPassword: string,
    ): Promise<{
        isValid: boolean
        message: string
    }> {
        try {
            this.logger.log(`Checking current password for user: ${userId}`)
            await this.authProvider.signIn(userId, currentPassword)
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

    async googleAuthentication(idToken: string): Promise<{
        user: any
        accessToken: string
        refreshToken: string
        idToken: string
        isNewUser: boolean
        message: string
    }> {
        try {
            this.logger.log("Processing Google authentication")

            // 1. Verify Google ID token
            const googleUserInfo = await this.verifyGoogleIdToken(idToken)

            if (!googleUserInfo) {
                throw new Error("Invalid Google ID token")
            }

            this.logger.log(`Google user verified: ${googleUserInfo.email}`)

            // 2. Find or create Cognito user
            const { cognitoUser, isNewUser, userPassword } =
                await this.findOrCreateCognitoUser(googleUserInfo)

            // 3. Generate auth tokens
            const authResult = await this.generateAuthTokens(
                cognitoUser,
                isNewUser,
                userPassword,
            )

            // 4. Build response
            return {
                user: cognitoUser,
                accessToken: authResult.AccessToken,
                refreshToken: authResult.RefreshToken,
                idToken: authResult.IdToken,
                isNewUser,
                message: isNewUser
                    ? "User created and authenticated successfully with Google"
                    : "User authenticated successfully with Google",
            }
        } catch (error) {
            this.logger.error("Error in Google authentication:", error)
            throw new Error(
                `Google authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            )
        }
    }

    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================

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
        cognitoUser: any
        isNewUser: boolean
        userPassword?: string
    }> {
        let cognitoUser: any = null
        let isNewUser = false
        let userPassword: string | undefined

        try {
            const existingUser = await this.authProvider.getUserByUsername(
                googleUserInfo.email,
            )
            if (existingUser) {
                cognitoUser = existingUser
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
        cognitoUser: any
        userPassword: string
    }> {
        const securePassword = `GoogleUser!${Date.now()}.${Math.random().toString(36)}`

        await this.authProvider.signUp(googleUserInfo.email, securePassword, {
            name: googleUserInfo.name || googleUserInfo.email,
            email: googleUserInfo.email,
            "custom:role": "DONOR",
        })

        await this.authProvider.adminConfirmSignUp(googleUserInfo.email)

        const createdUser = await this.authProvider.getUserByUsername(
            googleUserInfo.email,
        )

        this.logger.log(
            `New Google user created in Cognito: ${createdUser?.email}`,
        )

        // Create user in database
        const username = generateUniqueUsername(googleUserInfo.email)
        await this.userService.createUser({
            cognitoId: createdUser!.sub,
            email: createdUser!.email,
            username,
            fullName: createdUser!.name,
            role: "DONOR",
        })

        return { cognitoUser: createdUser, userPassword: securePassword }
    }

    private async generateAuthTokens(
        cognitoUser: any,
        isNewUser: boolean,
        userPassword?: string,
    ): Promise<{
        AccessToken: string
        RefreshToken: string
        IdToken: string
    }> {
        try {
            const tokenResult =
                await this.authProvider.generateTokensForOAuthUser(
                    cognitoUser.username,
                    userPassword,
                )

            this.logger.log(
                `JWT tokens generated successfully for user: ${cognitoUser.email}`,
            )

            return tokenResult
        } catch (error) {
            this.logger.error(
                "Failed to generate JWT tokens from Cognito:",
                error,
            )
            throw new Error(
                `Failed to generate authentication tokens: ${error instanceof Error ? error.message : "Unknown error"}`,
            )
        }
    }
}
