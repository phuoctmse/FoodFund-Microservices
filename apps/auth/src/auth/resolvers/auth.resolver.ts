import {
    Args,
    Query,
    Mutation,
    Context,
    Resolver,
    ID,
    ResolveReference,
} from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { UnauthorizedException } from "@nestjs/common"
import { CurrentUser } from "libs/auth"
import {
    AuthUser,
    AuthResponse,
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    SignInResponse,
    SignOutResponse,
    RefreshTokenResponse,
    AuthHealthResponse,
    CheckPasswordResponse,
    GoogleAuthResponse,
    ChangePasswordResponse,
} from "../models"
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
import { CognitoGraphQLGuard } from "libs/aws-cognito/guards"
import { AuthService } from "../services"

@Resolver(() => AuthUser)
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    // ============================================
    // FEDERATION & USER QUERIES
    // ============================================

    @Query(() => AuthUser, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "id", type: () => ID }) id: string,
    ): Promise<AuthUser | null> {
        return this.authService.getUserById(id)
    }

    @ResolveReference()
    resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<AuthUser | null> {
        return this.authService.getUserById(reference.id)
    }

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
    // REGISTRATION MUTATIONS
    // ============================================

    @Mutation(() => SignUpResponse)
    async signUp(@Args("input") input: SignUpInput): Promise<SignUpResponse> {
        return this.authService.signUp(input)
    }

    @Mutation(() => ConfirmSignUpResponse)
    async confirmSignUp(
        @Args("input") input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        return this.authService.confirmSignUp(input)
    }

    @Mutation(() => ResendCodeResponse)
    async resendConfirmationCode(
        @Args("input") input: ResendCodeInput,
    ): Promise<ResendCodeResponse> {
        return this.authService.resendConfirmationCode(input.email)
    }

    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Args("input") input: ForgotPasswordInput,
    ): Promise<ForgotPasswordResponse> {
        return this.authService.forgotPassword(input.email)
    }

    @Mutation(() => ResetPasswordResponse)
    async confirmForgotPassword(
        @Args("input") input: ConfirmForgotPasswordInput,
    ): Promise<ResetPasswordResponse> {
        return this.authService.confirmForgotPassword(
            input.email,
            input.confirmationCode,
            input.newPassword,
        )
    }

    // ============================================
    // AUTHENTICATION MUTATIONS & QUERIES
    // ============================================

    @Mutation(() => SignInResponse)
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        return this.authService.signIn(input)
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
        return this.authService.signOut(token)
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
        return this.authService.verifyToken(token)
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
        const user = await this.authService.verifyToken(token)
        return this.authService.validateUser(user)
    }

    @Mutation(() => RefreshTokenResponse)
    @UseGuards(CognitoGraphQLGuard)
    async refreshToken(
        @Args("input") input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authService.refreshToken(input)
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
        const success = await this.authService.changePassword(id, input)
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
        return this.authService.checkCurrentPassword(id, input)
    }

    @Mutation(() => GoogleAuthResponse)
    async googleAuth(
        @Args("input") input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        return this.authService.googleAuthentication(input)
    }
}
