import {
    Args,
    Query,
    Mutation,
    Resolver,
    ID,
    ResolveReference,
    Context,
} from "@nestjs/graphql"
import { UseGuards, UnauthorizedException } from "@nestjs/common"
import { AuthApplicationService } from "../../../application/services/auth-application.service"
import {
    SignInInput,
    SignUpInput,
    ConfirmSignUpInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
    RefreshTokenInput,
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../inputs"
import {
    SignInResponse,
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    RefreshTokenResponse,
    ChangePasswordResponse,
    CheckPasswordResponse,
    GoogleAuthResponse,
    AuthUser,
    AuthResponse,
    AuthHealthResponse,
    SignOutResponse,
} from "../models"
import { CognitoGraphQLGuard } from "libs/aws-cognito/guards"
import { CurrentUser } from "libs/auth"

/**
 * Presentation Resolver: Auth
 * GraphQL resolver for authentication operations
 */
@Resolver(() => AuthUser)
export class AuthResolver {
    constructor(
        private readonly authApplicationService: AuthApplicationService,
    ) {}

    // ============================================
    // HEALTH CHECK
    // ============================================

    @Query(() => AuthHealthResponse)
    async authHealth(): Promise<AuthHealthResponse> {
        return {
            status: "healthy",
            service: "auth",
            timestamp: new Date().toISOString(),
        }
    }

    // ============================================
    // FEDERATION & USER QUERIES
    // ============================================

    @Query(() => AuthUser, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "id", type: () => ID }) id: string,
    ): Promise<AuthUser | null> {
        const user = await this.authApplicationService.getUserById(id)
        if (!user) return null
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            emailVerified: user.emailVerified,
            provider: user.provider,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    }

    @ResolveReference()
    async resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<AuthUser | null> {
        return this.getUserByCognitoId(reference.id)
    }

    // ============================================
    // REGISTRATION MUTATIONS
    // ============================================

    @Mutation(() => SignUpResponse)
    async signUp(@Args("input") input: SignUpInput): Promise<SignUpResponse> {
        return this.authApplicationService.signUp({
            email: input.email,
            password: input.password,
            name: input.name,
        })
    }

    @Mutation(() => ConfirmSignUpResponse)
    async confirmSignUp(
        @Args("input") input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        await this.authApplicationService.confirmSignUp(
            input.email,
            input.confirmationCode,
        )
        return {
            confirmed: true,
            message: "Email confirmed successfully. You can now sign in.",
        }
    }

    @Mutation(() => ResendCodeResponse)
    async resendConfirmationCode(
        @Args("input") input: ResendCodeInput,
    ): Promise<ResendCodeResponse> {
        return this.authApplicationService.resendConfirmationCode(input.email)
    }

    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Args("input") input: ForgotPasswordInput,
    ): Promise<ForgotPasswordResponse> {
        await this.authApplicationService.forgotPassword(input.email)
        return {
            emailSent: true,
            message: "Password reset code sent to your email",
        }
    }

    @Mutation(() => ResetPasswordResponse)
    async confirmForgotPassword(
        @Args("input") input: ConfirmForgotPasswordInput,
    ): Promise<ResetPasswordResponse> {
        await this.authApplicationService.confirmForgotPassword(
            input.email,
            input.confirmationCode,
            input.newPassword,
        )
        return {
            passwordReset: true,
            message:
                "Password reset successful. You can now sign in with your new password.",
        }
    }

    // ============================================
    // AUTHENTICATION MUTATIONS & QUERIES
    // ============================================

    @Mutation(() => SignInResponse)
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        const result = await this.authApplicationService.signIn({
            email: input.email,
            password: input.password,
        })

        return {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            idToken: result.idToken,
            expiresIn: result.expiresIn,
            user: {
                id: result.user.id,
                email: result.user.email,
                username: result.user.username,
                name: result.user.name,
                emailVerified: result.user.emailVerified,
                provider: result.user.provider,
                createdAt: result.user.createdAt || new Date(),
                updatedAt: result.user.updatedAt || new Date(),
            },
            message: result.message,
        }
    }

    @Mutation(() => SignOutResponse)
    @UseGuards(CognitoGraphQLGuard)
    async signOut(@Context() context: any): Promise<SignOutResponse> {
        const token = context.req.headers.authorization?.split(" ")[1]
        if (!token) {
            throw new UnauthorizedException(
                "Access token not found in request headers",
            )
        }
        const result = await this.authApplicationService.signOut(token)
        return {
            success: result.success,
            message: "User signed out successfully",
            timestamp: new Date().toISOString(),
        }
    }

    @Query(() => AuthUser)
    @UseGuards(CognitoGraphQLGuard)
    async getCurrentUser(@Context() context: any): Promise<AuthUser> {
        const token = context.req.headers.authorization?.split(" ")[1]
        if (!token) {
            throw new UnauthorizedException(
                "Access token not found in request headers",
            )
        }
        const user = await this.authApplicationService.verifyToken(token)
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            emailVerified: user.emailVerified,
            provider: user.provider,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }
    }

    @Mutation(() => AuthResponse)
    @UseGuards(CognitoGraphQLGuard)
    async verifyToken(@Context() context: any): Promise<AuthResponse> {
        const token = context.req.headers.authorization?.split(" ")[1]
        if (!token) {
            throw new UnauthorizedException(
                "Access token not found in request headers",
            )
        }
        const user = await this.authApplicationService.verifyToken(token)
        return {
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
            message: "User validated successfully",
        }
    }

    @Mutation(() => RefreshTokenResponse)
    async refreshToken(
        @Args("input") input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authApplicationService.refreshToken(
            input.refreshToken,
            input.userName,
        )
    }

    // ============================================
    // USER PROFILE MUTATIONS
    // ============================================

    @Mutation(() => ChangePasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async changePassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: ChangePasswordInput,
    ): Promise<ChangePasswordResponse> {
        const success = await this.authApplicationService.changePassword(
            id,
            input.newPassword,
            input.confirmNewPassword,
        )
        return {
            success,
            message: success
                ? "Password changed successfully"
                : "Failed to change password",
            timestamp: new Date().toISOString(),
        }
    }

    @Mutation(() => CheckPasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async checkCurrentPassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: CheckCurrentPasswordInput,
    ): Promise<CheckPasswordResponse> {
        return this.authApplicationService.checkCurrentPassword(
            id,
            input.currentPassword,
        )
    }

    @Mutation(() => GoogleAuthResponse)
    async googleAuth(
        @Args("input") input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        const result = await this.authApplicationService.googleAuthentication(
            input.idToken,
        )
        return {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            idToken: result.idToken,
            isNewUser: result.isNewUser,
            message: result.message,
        }
    }
}
