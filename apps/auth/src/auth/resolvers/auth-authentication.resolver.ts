import {
    Args,
    Query,
    Mutation,
    Context,
    Resolver,
} from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    SignInResponse,
    RefreshTokenResponse,
} from "../models"
import { AuthResolver } from "../auth.resolver"
import {
    SignInInput,
    VerifyTokenInput,
    RefreshTokenInput,
} from "../dto"
import { CognitoGraphQLGuard } from "libs/aws-cognito/guards"

@Resolver()
export class AuthAuthenticationResolver {
    constructor(private authResolver: AuthResolver) {}

    @Mutation(() => SignInResponse)
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        return this.authResolver.signIn(input)
    }

    @Query(() => AuthUser)
    @UseGuards(CognitoGraphQLGuard)
    async getCurrentUser(@Context() context: any): Promise<AuthUser> {
        const token = context.req.headers.authorization?.split(" ")[1]
        return this.authResolver.verifyToken(token)
    }

    @Mutation(() => AuthResponse)
    async verifyToken(
        @Args("input") input: VerifyTokenInput,
    ): Promise<AuthResponse> {
        const user = await this.authResolver.verifyToken(input.accessToken)
        return this.authResolver.validateUser(user)
    }

    @Mutation(() => RefreshTokenResponse)
    async refreshToken(
        @Args("input") input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authResolver.refreshToken(input)
    }
}