import { Args, Query, Mutation, Context, Resolver } from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { UnauthorizedException } from "@nestjs/common"
import {
    AuthUser,
    AuthResponse,
    SignInResponse,
    RefreshTokenResponse,
    SignOutResponse,
} from "../../../domain/entities"
import { SignInInput, RefreshTokenInput } from "../../../application/dtos"
import { CognitoGraphQLGuard } from "libs/aws-cognito/guards"
import { AuthAuthenticationService, AuthUserService } from "../../../application/services"

@Resolver()
export class AuthAuthenticationResolver {
    constructor(
        private readonly authAuthenticationService: AuthAuthenticationService,
        private readonly authUserService: AuthUserService,
    ) {}

    @Mutation(() => SignOutResponse)
    @UseGuards(CognitoGraphQLGuard)
    async signOut(@Context() context: any): Promise<SignOutResponse> {
        const token = context.req.headers.authorization?.split(" ")[1]
        if (!token) {
            throw new UnauthorizedException(
                "Access token not found in request headers",
            )
        }
        const result = await this.authAuthenticationService.signOut(token)
        return {
            ...result,
            timestamp: new Date().toISOString(),
        }
    }

    @Mutation(() => SignInResponse)
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        return this.authAuthenticationService.signIn(input)
    }

    @Query(() => AuthUser)
    @UseGuards(CognitoGraphQLGuard)
    async getCurrentUser(@Context() context: any): Promise<AuthUser> {
        const token = context.req.headers.authorization?.split(" ")[1]
        return this.authAuthenticationService.verifyToken(token)
    }

    @Mutation(() => AuthResponse)
    @UseGuards(CognitoGraphQLGuard)
    async verifyToken(@Context() context: any): Promise<AuthResponse> {
        const token = context.req.headers.authorization?.split(" ")[1]
        const user = await this.authAuthenticationService.verifyToken(token)
        return this.authUserService.validateUser(user)
    }

    @Mutation(() => RefreshTokenResponse)
    @UseGuards(CognitoGraphQLGuard)
    async refreshToken(
        @Args("input") input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authAuthenticationService.refreshToken(input)
    }
}
