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
import {
    AuthenticationService,
    UserService,
} from "../../../application/services"

@Resolver()
export class AuthenticationResolver {
    constructor(
        private readonly authenticationService: AuthenticationService,
        private readonly userService: UserService,
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
        const result = await this.authenticationService.signOut(token)
        return {
            ...result
        }
    }

    @Mutation(() => SignInResponse)
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        return this.authenticationService.signIn(input)
    }

    @Query(() => AuthUser)
    @UseGuards(CognitoGraphQLGuard)
    async getCurrentUser(@Context() context: any): Promise<AuthUser> {
        const token = context.req.headers.authorization?.split(" ")[1]
        return this.authenticationService.verifyToken(token)
    }

    @Mutation(() => AuthResponse)
    @UseGuards(CognitoGraphQLGuard)
    async verifyToken(@Context() context: any): Promise<AuthResponse> {
        const token = context.req.headers.authorization?.split(" ")[1]
        const user = await this.authenticationService.verifyToken(token)
        return this.userService.validateUser(user)
    }

    @Mutation(() => RefreshTokenResponse)
    @UseGuards(CognitoGraphQLGuard)
    async refreshToken(
        @Args("input") input: RefreshTokenInput,
    ): Promise<RefreshTokenResponse> {
        return this.authenticationService.refreshToken(input)
    }
}
