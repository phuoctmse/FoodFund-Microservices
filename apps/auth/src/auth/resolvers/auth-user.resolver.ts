import {
    Args,
    ID,
    Query,
    Resolver,
    ResolveReference,
    Mutation,
} from "@nestjs/graphql"
import {
    AuthUser,
    CheckPasswordResponse,
    GoogleAuthResponse,
    ChangePasswordResponse,
} from "../models"
import {
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../dto/auth.input"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { UseGuards } from "@nestjs/common"
import { CurrentUser } from "libs/auth"
import { AuthUserService } from "../services"

@Resolver(() => AuthUser)
export class AuthUserResolver {
    constructor(private readonly authUserService: AuthUserService) {}

    @Query(() => AuthUser, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "id", type: () => ID }) id: string,
    ): Promise<AuthUser | null> {
        return this.authUserService.getUserById(id)
    }

    // **FEDERATION**
    @ResolveReference()
    resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<AuthUser | null> {
        return this.authUserService.getUserById(reference.id)
    }

    @Mutation(() => ChangePasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async changePassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: ChangePasswordInput,
    ): Promise<ChangePasswordResponse> {
        const success = await this.authUserService.changePassword(id, input)
        return {
            success,
            message: success
                ? "Password changed successfully"
                : "Failed to change password",
            timestamp: new Date().toISOString(),
        }
    }

    @Mutation(() => CheckPasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async checkCurrentPassword(
        @CurrentUser() { id }: { id: string },
        @Args("input") input: CheckCurrentPasswordInput,
    ): Promise<CheckPasswordResponse> {
        return this.authUserService.checkCurrentPassword(id, input)
    }

    @Mutation(() => GoogleAuthResponse)
    async googleAuthentication(
        @Args("input") input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        return this.authUserService.googleAuthentication(input)
    }
}
