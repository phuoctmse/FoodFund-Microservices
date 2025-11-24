import {
    Resolver,
    Query,
    ResolveReference,
    ObjectType,
    Field,
} from "@nestjs/graphql"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType } from "libs/auth"
import { UserQueryService } from "@app/user/src/application/services"
import { UserProfileSchema } from "@app/user/src/domain/entities"
import { UserHealthResponse } from "@app/user/src/shared/types"

@ObjectType()
export class RoleProfileResponse {
    @Field(() => String)
        message: string

    @Field(() => UserProfileSchema)
        userProfile: UserProfileSchema
}

@Resolver(() => UserProfileSchema)
export class UserQueryResolver {
    constructor(
        private readonly userQueryService: UserQueryService,
    ) {}

    @Query(() => UserHealthResponse, {
        name: "userHealth",
        description: "Health check endpoint for user service",
    })
    async userHealth(): Promise<UserHealthResponse> {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
        }
    }

    @Query(() => RoleProfileResponse, {
        name: "getMyProfile",
        description: "Get current user profile with role-based information (requires authentication)",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyProfile(
        @CurrentUser() user: CurrentUserType,
    ): Promise<RoleProfileResponse> {
        if (!user) {
            throw new Error("User not authenticated")
        }

        // Try multiple sources for cognito_id
        const cognito_id = user.cognitoId || user.sub || user.id

        if (!cognito_id) {
            throw new Error("User cognito_id not found")
        }

        // Get user info to determine role
        const userInfo =
            await this.userQueryService.findUserByCognitoId(cognito_id)
        if (!userInfo) {
            throw new Error("User not found in database")
        }

        const role = userInfo.role
        const response: RoleProfileResponse = {
            message: `Profile for ${role.toLowerCase()} user`,
            userProfile: userInfo,
        }

        return response
    }

    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userQueryService.resolveReference(reference)
    }
}
