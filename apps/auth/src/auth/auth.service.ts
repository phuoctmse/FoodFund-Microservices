import { Injectable, Logger } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    HealthResponse,
    SignUpResponse,
    ConfirmSignUpResponse,
    SignInResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
} from "./models"
import { AwsCognitoService } from "libs/aws-cognito"
import { CognitoUser } from "libs/aws-cognito/aws-cognito.types"
import { ConfirmSignUpInput, SignInInput, SignUpInput } from "./dto"

@Injectable()
export class AuthSubgraphService {
    private readonly logger = new Logger(AuthSubgraphService.name)

    constructor(private readonly cognitoService: AwsCognitoService) {}

    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        const { email, password, name, phoneNumber } = input

        const attributes: Record<string, string> = {}
        if (name) attributes.name = name
        if (phoneNumber) attributes.phone_number = phoneNumber

        const result = await this.cognitoService.signUp(
            email,
            password,
            attributes,
        )

        return {
            userSub: result.userSub as string,
            message:
        "Sign up successful. Please check your email for verification code.",
            emailSent: true,
        }
    }

    async confirmSignUp(
        input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        const { email, confirmationCode } = input

        await this.cognitoService.confirmSignUp(email, confirmationCode)

        return {
            confirmed: true,
            message: "Email confirmed successfully. You can now sign in.",
        }
    }

    async signIn(input: SignInInput): Promise<SignInResponse> {
        const { email, password } = input

        // Authenticate with Cognito
        const authResult = await this.cognitoService.signIn(email, password)

        // Get user details using access token
        const cognitoUserResponse = await this.cognitoService.getUser(
      authResult.AccessToken as string,
        )

        // Create AuthUser from Cognito response
        const user: AuthUser = {
            id: cognitoUserResponse.Username || "",
            email:
        this.cognitoService.getAttributeValue(
            cognitoUserResponse.UserAttributes || [],
            "email",
        ) || email,
            username: cognitoUserResponse.Username || email,
            name: this.cognitoService.getAttributeValue(
                cognitoUserResponse.UserAttributes || [],
                "name",
            ),
            provider: "aws-cognito",
            createdAt: "UserCreateDate" in cognitoUserResponse ? cognitoUserResponse.UserCreateDate as Date : new Date(),
        }

        return {
            user,
            accessToken: authResult.AccessToken as string,
            refreshToken: authResult.RefreshToken as string,
            idToken: authResult.IdToken as string,
            expiresIn: authResult.ExpiresIn as number,
            message: "Sign in successful",
        }
    }

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        await this.cognitoService.forgotPassword(email)

        return {
            emailSent: true,
            message: "Password reset code sent to your email.",
        }
    }

    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ): Promise<ResetPasswordResponse> {
        await this.cognitoService.confirmForgotPassword(
            email,
            confirmationCode,
            newPassword,
        )

        return {
            passwordReset: true,
            message:
        "Password reset successful. You can now sign in with your new password.",
        }
    }

    async resendConfirmationCode(
        email: string,
    ): Promise<{ emailSent: boolean; message: string }> {
        await this.cognitoService.resendConfirmationCode(email)

        return {
            emailSent: true,
            message: "Confirmation code resent to your email.",
        }
    }

    /**
   * Convert CognitoUser to AuthUser for GraphQL
   */
    private mapCognitoUserToAuthUser(cognitoUser: CognitoUser): AuthUser {
        return {
            id: cognitoUser.sub,
            email: cognitoUser.email,
            username: cognitoUser.username,
            name: cognitoUser.name || cognitoUser.givenName,
            provider: "aws-cognito",
            createdAt: cognitoUser.createdAt || new Date(),
        }
    }

    /**
   * Verify token using AWS Cognito
   */
    async verifyToken(accessToken: string): Promise<AuthUser> {
        try {
            // Validate token with Cognito
            const decodedToken = await this.cognitoService.validateToken(accessToken)

            // Get user details from Cognito
            const cognitoUserResponse =
        await this.cognitoService.getUser(accessToken)

            // Map Cognito response to our AuthUser interface
            const cognitoUser: CognitoUser = {
                sub: decodedToken.sub,
                email:
          (decodedToken as any).email ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "email",
          ) ||
          "",
                emailVerified: (decodedToken as any).email_verified || false,
                username:
          (decodedToken as any)["cognito:username"] ||
          cognitoUserResponse.Username ||
          "",
                name:
          (decodedToken as any).name ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "name",
          ),
                givenName:
          (decodedToken as any).given_name ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "given_name",
          ),
                familyName:
          (decodedToken as any).family_name ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "family_name",
          ),
                picture:
          (decodedToken as any).picture ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "picture",
          ),
                phoneNumber:
          (decodedToken as any).phone_number ||
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "phone_number",
          ),
                phoneNumberVerified:
          (decodedToken as any).phone_number_verified || false,
                groups: (decodedToken as any)["cognito:groups"] || [],
                customAttributes: this.cognitoService.extractCustomAttributes(
                    cognitoUserResponse.UserAttributes || [],
                ),
                cognitoUser: cognitoUserResponse,
                provider: "aws-cognito",
                createdAt: "UserCreateDate" in cognitoUserResponse ? cognitoUserResponse.UserCreateDate as Date : new Date(),
                updatedAt: "UserLastModifiedDate" in cognitoUserResponse ? cognitoUserResponse.UserLastModifiedDate as Date : new Date(),
            }

            return this.mapCognitoUserToAuthUser(cognitoUser)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.logger.error(`Token verification failed: ${errorMessage}`)
            throw new Error("Invalid token")
        }
    }

    /**
   * Get user by ID using AWS Cognito
   */
    async getUserById(userId: string): Promise<AuthUser | null> {
        try {
            // In Cognito, userId is typically the 'sub' claim
            const cognitoUserResponse =
        await this.cognitoService.getUserByUsername(userId)

            const cognitoUser: CognitoUser = {
                sub: userId,
                email:
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "email",
          ) || "",
                emailVerified:
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "email_verified",
          ) === "true",
                username: cognitoUserResponse.Username || "",
                name: this.cognitoService.getAttributeValue(
                    cognitoUserResponse.UserAttributes || [],
                    "name",
                ),
                givenName: this.cognitoService.getAttributeValue(
                    cognitoUserResponse.UserAttributes || [],
                    "given_name",
                ),
                familyName: this.cognitoService.getAttributeValue(
                    cognitoUserResponse.UserAttributes || [],
                    "family_name",
                ),
                picture: this.cognitoService.getAttributeValue(
                    cognitoUserResponse.UserAttributes || [],
                    "picture",
                ),
                phoneNumber: this.cognitoService.getAttributeValue(
                    cognitoUserResponse.UserAttributes || [],
                    "phone_number",
                ),
                phoneNumberVerified:
          this.cognitoService.getAttributeValue(
              cognitoUserResponse.UserAttributes || [],
              "phone_number_verified",
          ) === "true",
                groups: [], // Admin API doesn't return groups, would need separate call
                customAttributes: this.cognitoService.extractCustomAttributes(
                    cognitoUserResponse.UserAttributes || [],
                ),
                cognitoUser: cognitoUserResponse,
                provider: "aws-cognito",
                createdAt: "UserCreateDate" in cognitoUserResponse ? cognitoUserResponse.UserCreateDate as Date : new Date(),
                updatedAt: "UserLastModifiedDate" in cognitoUserResponse ? cognitoUserResponse.UserLastModifiedDate as Date : new Date(),
            }

            return this.mapCognitoUserToAuthUser(cognitoUser)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.logger.error(`Failed to get user by ID: ${errorMessage}`)
            return null
        }
    }

    /**
   * Validate user authentication status
   */
    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return {
            user,
            message: "Authentication successful via AWS Cognito",
        }
    }

    /**
   * Health check endpoint
   */
    getHealth(): HealthResponse {
        return {
            status: "healthy",
            service: "Auth Subgraph (AWS Cognito Integration)",
            timestamp: new Date().toISOString(),
        }
    }
}
