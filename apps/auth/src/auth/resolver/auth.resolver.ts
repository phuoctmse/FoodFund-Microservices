// apps/auth/src/auth/resolver/auth.resolver.ts
import {
    Args,
    ID,
    Query,
    Resolver,
    ResolveReference,
    Mutation,
    Context,
} from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    HealthResponse,
    SignUpResponse,
    SignInResponse,
    ConfirmSignUpResponse,
    ForgotPasswordResponse,
    ResetPasswordResponse,
    ResendCodeResponse,
} from "../models"
import { AuthSubgraphService } from "../auth.service"
import {
    SignUpInput,
    SignInInput,
    ConfirmSignUpInput,
    VerifyTokenInput,
    GetUserInput,
    ForgotPasswordInput,
    ConfirmForgotPasswordInput,
    ResendCodeInput,
} from "../dto"
import { CognitoGraphQLGuard } from "libs/aws-cognito/guards"

@Resolver((of) => AuthUser)
export class AuthResolver {
    constructor(private authService: AuthSubgraphService) {}

  // Health Check
  @Query((returns) => HealthResponse)
    async authHealth(): Promise<HealthResponse> {
        return this.authService.getHealth()
    }

  // **SIGN UP FLOW**
  @Mutation((returns) => SignUpResponse)
  async signUp(@Args("input") input: SignUpInput): Promise<SignUpResponse> {
      return this.authService.signUp(input)
  }

  @Mutation((returns) => ConfirmSignUpResponse)
  async confirmSignUp(
    @Args("input") input: ConfirmSignUpInput,
  ): Promise<ConfirmSignUpResponse> {
      return this.authService.confirmSignUp(input)
  }

  @Mutation((returns) => ResendCodeResponse)
  async resendConfirmationCode(
    @Args("input") input: ResendCodeInput,
  ): Promise<ResendCodeResponse> {
      return this.authService.resendConfirmationCode(input.email)
  }

  // **SIGN IN FLOW**
  @Mutation((returns) => SignInResponse)
  async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
      return this.authService.signIn(input)
  }

  // **FORGOT PASSWORD FLOW**
  @Mutation((returns) => ForgotPasswordResponse)
  async forgotPassword(
    @Args("input") input: ForgotPasswordInput,
  ): Promise<ForgotPasswordResponse> {
      return this.authService.forgotPassword(input.email)
  }

  @Mutation((returns) => ResetPasswordResponse)
  async confirmForgotPassword(
    @Args("input") input: ConfirmForgotPasswordInput,
  ): Promise<ResetPasswordResponse> {
      return this.authService.confirmForgotPassword(
          input.email,
          input.confirmationCode,
          input.newPassword,
      )
  }

  // **PROTECTED ENDPOINTS**
  @Query((returns) => AuthUser)
  @UseGuards(CognitoGraphQLGuard)
  async getCurrentUser(@Context() context: any): Promise<AuthUser> {
      const token = context.req.headers.authorization?.split(" ")[1]
      return this.authService.verifyToken(token)
  }

  @Query((returns) => AuthUser, { nullable: true })
  async getUserById(
    @Args({ name: "id", type: () => ID }) id: string,
  ): Promise<AuthUser | null> {
      return this.authService.getUserById(id)
  }

  // **FEDERATION**
  @ResolveReference()
  resolveReference(reference: {
    __typename: string;
    id: string;
  }): Promise<AuthUser | null> {
      return this.authService.getUserById(reference.id)
  }

  // **LEGACY SUPPORT**
  @Mutation((returns) => AuthResponse)
  async verifyToken(
    @Args("input") input: VerifyTokenInput,
  ): Promise<AuthResponse> {
      const user = await this.authService.verifyToken(input.accessToken)
      return this.authService.validateUser(user)
  }
}
