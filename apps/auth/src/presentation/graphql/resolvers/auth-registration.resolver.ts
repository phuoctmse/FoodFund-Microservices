import { Args, Query, Mutation, Resolver } from "@nestjs/graphql"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    AuthHealthResponse,
} from "../../../domain/entities"
import { AuthRegistrationService } from "../../../application/services"
import {
    SignUpInput,
    ConfirmSignUpInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
} from "../../../application/dtos"

@Resolver()
export class AuthRegistrationResolver {
    constructor(
        private readonly authRegistrationService: AuthRegistrationService,
    ) {}

    @Query(() => AuthHealthResponse)
    async authHealth(): Promise<AuthHealthResponse> {
        return {
            status: "healthy",
            service: "auth",
            timestamp: new Date().toISOString(),
        }
    }

    @Mutation(() => SignUpResponse)
    async signUp(@Args("input") input: SignUpInput): Promise<SignUpResponse> {
        return this.authRegistrationService.signUp(input)
    }

    @Mutation(() => ConfirmSignUpResponse)
    async confirmSignUp(
        @Args("input") input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        return this.authRegistrationService.confirmSignUp(input)
    }

    @Mutation(() => ResendCodeResponse)
    async resendConfirmationCode(
        @Args("input") input: ResendCodeInput,
    ): Promise<ResendCodeResponse> {
        return this.authRegistrationService.resendConfirmationCode(input.email)
    }

    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Args("input") input: ForgotPasswordInput,
    ): Promise<ForgotPasswordResponse> {
        return this.authRegistrationService.forgotPassword(input.email)
    }

    @Mutation(() => ResetPasswordResponse)
    async confirmForgotPassword(
        @Args("input") input: ConfirmForgotPasswordInput,
    ): Promise<ResetPasswordResponse> {
        return this.authRegistrationService.confirmForgotPassword(
            input.email,
            input.confirmationCode,
            input.newPassword,
        )
    }
}
