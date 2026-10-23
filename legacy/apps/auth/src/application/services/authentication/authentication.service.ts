import { Injectable, Logger, UnauthorizedException, Inject } from "@nestjs/common"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import { GetUserCommandOutput } from "@aws-sdk/client-cognito-identity-provider"
import { SignInInput, RefreshTokenInput } from "../../dtos"
import {
    AuthUser,
    SignInResponse,
    RefreshTokenResponse,
    SignOutResponse,
} from "../../../domain/entities"
import { IUserService, USER_SERVICE_TOKEN } from "../../../domain/interfaces"
import { AuthErrorHelper } from "../../../shared/helpers"

@Injectable()
export class AuthenticationService {
    private readonly logger = new Logger(AuthenticationService.name)

    constructor(
        private readonly awsCognitoService: AwsCognitoService,
        @Inject(USER_SERVICE_TOKEN)
        private readonly userService: IUserService,
    ) { }

    async signIn(input: SignInInput): Promise<SignInResponse> {
        try {
            this.logger.log(`Attempting to sign in user: ${input.email}`)

            const result = await this.awsCognitoService.signIn(
                input.email,
                input.password,
            )

            // Get user details from access token
            const userOutput = await this.awsCognitoService.getUser(
                result.AccessToken!,
            )
            const user = this.convertGetUserOutputToCognitoUser(userOutput)

            // Check if user is active in User Service
            await this.validateUserIsActive(user.sub)

            this.logger.log(`User signed in successfully: ${user.sub}`)

            return {
                user: this.mapCognitoUserToAuthUser(user),
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

    /**
     * Validate if user is active in User Service
     * Throws UnauthorizedException if user is not active
     */
    private async validateUserIsActive(cognitoId: string): Promise<void> {
        await this.userService.isUserActive(cognitoId)
    }

    async verifyToken(accessToken: string): Promise<AuthUser> {
        try {
            this.logger.log("Verifying access token")

            const userOutput = await this.awsCognitoService.getUser(accessToken)
            const cognitoUser =
                this.convertGetUserOutputToCognitoUser(userOutput)
            const user = this.mapCognitoUserToAuthUser(cognitoUser)

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

    async signOut(
        accessToken: string,
    ): Promise<SignOutResponse> {
        try {
            this.logger.log("Processing sign out request")

            const result = await this.awsCognitoService.signOut(accessToken)

            this.logger.log("User signed out successfully")

            return {
                success: result.success,
                message: "User signed out successfully",
                timestamp: new Date().toISOString()
            }
        } catch (error) {
            this.logger.error("Sign out failed:", error)
            throw AuthErrorHelper.mapCognitoError(error, "signOut")
        }
    }

    private convertGetUserOutputToCognitoUser(
        output: GetUserCommandOutput,
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
            createdAt: new Date(),
            updatedAt: new Date(),
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
}
