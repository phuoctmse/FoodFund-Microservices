import { Injectable } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    AuthHealthResponse,
    SignUpResponse,
    SignInResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    RefreshTokenResponse,
    SignOutResponse,
} from "./models"
import {
    SignUpInput,
    SignInInput,
    ConfirmSignUpInput,
    VerifyTokenInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
    RefreshTokenInput,
} from "./dto"
import { AuthService } from "./auth.service"

import { UpdateUserInput, ChangePasswordInput } from "./dto/auth.input"

//Apply Facade Pattern
@Injectable()
export class AuthResolver {
    constructor(private authService: AuthService) {}

    // Health
    async getHealth(): Promise<AuthHealthResponse> {
        return this.authService.getHealth()
    }

    // Registration operations
    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        return this.authService.signUp(input)
    }

    async confirmSignUp(
        input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        return this.authService.confirmSignUp(input)
    }

    async resendConfirmationCode(email: string): Promise<ResendCodeResponse> {
        return this.authService.resendConfirmationCode(email)
    }

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        return this.authService.forgotPassword(email)
    }

    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ): Promise<ResetPasswordResponse> {
        return this.authService.confirmForgotPassword(
            email,
            confirmationCode,
            newPassword,
        )
    }

    // Authentication operations
    async signIn(input: SignInInput): Promise<SignInResponse> {
        return this.authService.signIn(input)
    }

    async verifyToken(accessToken: string): Promise<AuthUser> {
        return this.authService.verifyToken(accessToken)
    }

    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return this.authService.validateUser(user)
    }

    async refreshToken(
        input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authService.refreshToken(input)
    }

    async signOut(accessToken: string): Promise<SignOutResponse> {
        const result = await this.authService.signOut(accessToken)
        return {
            message: result.message,
            success: result.success,
            timestamp: new Date().toISOString(),
        }
    }

    // User operations
    async getUserById(id: string): Promise<AuthUser | null> {
        return this.authService.getUserById(id)
    }
    async changePassword(
        id: string,
        input: ChangePasswordInput,
    ): Promise<boolean> {
        return this.authService.changePassword(id, input)
    }
}
