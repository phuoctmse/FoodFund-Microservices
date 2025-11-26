import { Args, Query, Mutation, Resolver } from "@nestjs/graphql"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    AuthHealthResponse,
} from "../../../../domain/entities"
import { RegistrationService } from "../../../../application/services"
import {
    SignUpInput,
    ConfirmSignUpInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
} from "../../../../application/dtos"

@Resolver()
export class RegistrationResolver {
    constructor(
        private readonly registrationService: RegistrationService,
    ) { }

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
        return this.registrationService.signUp(input)
    }

    @Mutation(() => ConfirmSignUpResponse)
    async confirmSignUp(
        @Args("input") input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        return this.registrationService.confirmSignUp(input)
    }

    @Mutation(() => ResendCodeResponse)
    async resendConfirmationCode(
        @Args("input") input: ResendCodeInput,
    ): Promise<ResendCodeResponse> {
        return this.registrationService.resendConfirmationCode(input.email)
    }

    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Args("input") input: ForgotPasswordInput,
    ): Promise<ForgotPasswordResponse> {
        return this.registrationService.forgotPassword(input.email)
    }

    @Mutation(() => ResetPasswordResponse)
    async confirmForgotPassword(
        @Args("input") input: ConfirmForgotPasswordInput,
    ): Promise<ResetPasswordResponse> {
        return this.registrationService.confirmForgotPassword(
            input.email,
            input.confirmationCode,
            input.newPassword,
        )
    }
}
