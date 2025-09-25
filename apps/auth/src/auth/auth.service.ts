import { Injectable, Logger } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    AuthHealthResponse,
    SignUpResponse,
    ConfirmSignUpResponse,
    SignInResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    RefreshTokenResponse,
} from "./models"
import {
    ConfirmSignUpInput,
    SignInInput,
    SignUpInput,
    RefreshTokenInput,
} from "./dto"
import {
    AuthRegistrationService,
    AuthAuthenticationService,
    AuthUserService,
} from "./services"

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name)

    constructor(
        private readonly authRegistrationService: AuthRegistrationService,
        private readonly authAuthenticationService: AuthAuthenticationService,
        private readonly authUserService: AuthUserService,
    ) {}

    async getHealth(): Promise<AuthHealthResponse> {
        return {
            status: "OK",
            timestamp: new Date().toISOString(),
            service: "auth-service",
        }
    }

    // Registration methods
    async signUp(input: SignUpInput): Promise<SignUpResponse> {
        return this.authRegistrationService.signUp(input)
    }

    async confirmSignUp(input: ConfirmSignUpInput): Promise<ConfirmSignUpResponse> {
        return this.authRegistrationService.confirmSignUp(input)
    }

    async resendConfirmationCode(email: string): Promise<{ emailSent: boolean; message: string }> {
        return this.authRegistrationService.resendConfirmationCode(email)
    }

    async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
        return this.authRegistrationService.forgotPassword(email)
    }

    async confirmForgotPassword(
        email: string,
        confirmationCode: string,
        newPassword: string,
    ): Promise<ResetPasswordResponse> {
        return this.authRegistrationService.confirmForgotPassword(email, confirmationCode, newPassword)
    }

    // Authentication methods
    async signIn(input: SignInInput): Promise<SignInResponse> {
        return this.authAuthenticationService.signIn(input)
    }

    async verifyToken(accessToken: string): Promise<AuthUser> {
        return this.authAuthenticationService.verifyToken(accessToken)
    }

    async refreshToken(input: RefreshTokenInput): Promise<RefreshTokenResponse> {
        return this.authAuthenticationService.refreshToken(input)
    }

    async signOut(accessToken: string): Promise<{ success: boolean; message: string }> {
        return this.authAuthenticationService.signOut(accessToken)
    }

    // User methods
    async getUserById(id: string): Promise<AuthUser | null> {
        return this.authUserService.getUserById(id)
    }

    async validateUser(user: AuthUser): Promise<AuthResponse> {
        return this.authUserService.validateUser(user)
    }
}