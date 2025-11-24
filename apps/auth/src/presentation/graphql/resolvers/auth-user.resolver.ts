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
} from "../../../domain/entities"
import {
    ChangePasswordInput,
    CheckCurrentPasswordInput,
    GoogleAuthInput,
} from "../../../application/dtos/auth.input"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { UseGuards } from "@nestjs/common"
import { CurrentUser, CurrentUserType } from "libs/auth"
import { UserService } from "../../../application/services"

@Resolver(() => AuthUser)
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    @Query(() => AuthUser, { nullable: true })
    async getUserByCognitoId(
        @Args({ name: "id", type: () => ID }) id: string,
    ): Promise<AuthUser | null> {
        return this.userService.getUserById(id)
    }

    // **FEDERATION**
    @ResolveReference()
    resolveReference(reference: {
        __typename: string
        id: string
    }): Promise<AuthUser | null> {
        return this.userService.getUserById(reference.id)
    }

    @Mutation(() => ChangePasswordResponse)
    @UseGuards(CognitoGraphQLGuard)
    async changePassword(
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: ChangePasswordInput,
    ): Promise<ChangePasswordResponse> {
        const success = await this.userService.changePassword(
            user.username,
            input,
        )
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
        @CurrentUser() user: CurrentUserType,
        @Args("input") input: CheckCurrentPasswordInput,
    ): Promise<CheckPasswordResponse> {
        return this.userService.checkCurrentPassword(user.username, input)
    }

    @Mutation(() => GoogleAuthResponse)
    async googleAuthentication(
        @Args("input") input: GoogleAuthInput,
    ): Promise<GoogleAuthResponse> {
        return this.userService.googleAuthentication(input)
    }
}
