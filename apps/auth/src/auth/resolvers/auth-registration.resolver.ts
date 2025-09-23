import {
    Args,
    Query,
    Mutation,
    Resolver,
} from "@nestjs/graphql"
import {
    SignUpResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
    AuthHealthResponse,
} from "../models"
import { AuthResolver } from "../auth.resolver"
import {
    SignUpInput,
    ConfirmSignUpInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
} from "../dto"

@Resolver()
export class AuthRegistrationResolver {
    constructor(private authResolver: AuthResolver) {}

    @Query(() => AuthHealthResponse)
    async authHealth(): Promise<AuthHealthResponse> {
        return this.authResolver.getHealth()
    }

    @Mutation(() => SignUpResponse)
    async signUp(@Args("input") input: SignUpInput): Promise<SignUpResponse> {
        return this.authResolver.signUp(input)
    }

    @Mutation(() => ConfirmSignUpResponse)
    async confirmSignUp(
        @Args("input") input: ConfirmSignUpInput,
    ): Promise<ConfirmSignUpResponse> {
        return this.authResolver.confirmSignUp(input)
    }

    @Mutation(() => ResendCodeResponse)
    async resendConfirmationCode(
        @Args("input") input: ResendCodeInput,
    ): Promise<ResendCodeResponse> {
        return this.authResolver.resendConfirmationCode(input.email)
    }

    @Mutation(() => ForgotPasswordResponse)
    async forgotPassword(
        @Args("input") input: ForgotPasswordInput,
    ): Promise<ForgotPasswordResponse> {
        return this.authResolver.forgotPassword(input.email)
    }

    @Mutation(() => ResetPasswordResponse)
    async confirmForgotPassword(
        @Args("input") input: ConfirmForgotPasswordInput,
    ): Promise<ResetPasswordResponse> {
        return this.authResolver.confirmForgotPassword(
            input.email,
            input.confirmationCode,
            input.newPassword,
        )
    }
}