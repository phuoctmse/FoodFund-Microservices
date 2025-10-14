import { Args, ID, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { AuthUser, CheckPasswordResponse, GoogleAuthResponse } from "../models"
import { AuthResolver } from "../auth.resolver"
import {
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../dto/auth.input"
import { Mutation } from "@nestjs/graphql"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "libs/auth"

@Resolver(() => AuthUser)
export class AuthUserResolver {
    constructor(private authResolver: AuthResolver) {}

    @Query(() => AuthUser, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "id", type: () => ID }) id: string,
    ): Promise<AuthUser | null> {
        return this.authResolver.getUserById(id)
    }

    // **FEDERATION**
    @ResolveReference()
    resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<AuthUser | null> {
        return this.authResolver.getUserById(reference.id)
    }

    @Mutation(() => Boolean)
    @UseGuards(CognitoGraphQLGuard)
    async changePassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: ChangePasswordInput,
    ): Promise<boolean> {
        return this.authResolver.changePassword(id, input)
    }

    @Mutation(() => CheckPasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async checkCurrentPassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: CheckCurrentPasswordInput,
    ): Promise<CheckPasswordResponse> {
        return this.authResolver.checkCurrentPassword(id, input)
    }

    @Mutation(() => GoogleAuthResponse)
    async googleAuthentication(
        @Args("input") input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        return this.authResolver.googleAuthentication(input)
    }
}
