import {
    Resolver,
    Query,
    Args,
    ID,
    ResolveReference,
    Context,
} from "@nestjs/graphql"
import { UserProfileSchema, Role } from "libs/databases/prisma/schemas"
import { UserHealthResponse } from "../types/health-response.model"
import { UserResolver as UserResolverFacade } from "../user.resolver"
import { UseGuards } from "@nestjs/common"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => UserProfileSchema)
export class UserQueryResolver {
    constructor(private readonly userResolverFacade: UserResolverFacade) {}

    @Query(() => UserHealthResponse, { name: "userHealth" })
    async userHealth(): Promise<UserHealthResponse> {
        return this.userResolverFacade.getHealth()
    }

    @Query(() => UserProfileSchema, { name: "getUserProfile" })
    @UseGuards(CognitoGraphQLGuard)
    async getUserProfile(@Context() context: any) {
        const user = context.req.user
        if (!user || !user.username) {
            throw new Error("Unauthorized: missing Cognito user info")
        }
        const userProfile = await this.userResolverFacade.findUserByCognitoId(
            user.username,
        )
        if (!userProfile) {
            throw new Error("User not found")
        }
        return userProfile
    }

    @Query(() => [UserProfileSchema], { name: "users" })
    async findAllUsers(
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number,
    ) {
        return this.userResolverFacade.findAllUsers(skip, take)
    }

    @Query(() => UserProfileSchema, { name: "user" })
    async findUserById(@Args("id", { type: () => ID }) id: string) {
        return this.userResolverFacade.findUserById(id)
    }

    @Query(() => UserProfileSchema, { name: "userByEmail" })
    async findUserByEmail(@Args("email") email: string) {
        return this.userResolverFacade.findUserByEmail(email)
    }

    @Query(() => UserProfileSchema, { name: "userByUsername" })
    async findUserByUsername(@Args("user_name") user_name: string) {
        return this.userResolverFacade.findUserByUsername(user_name)
    }

    @Query(() => [UserProfileSchema], { name: "searchUsers" })
    async searchUsers(
        @Args("searchTerm") searchTerm: string,
        @Args("role", { nullable: true }) role?: string,
    ) {
        return this.userResolverFacade.searchUsers(searchTerm, role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "usersByRole" })
    async getUsersByRole(@Args("role") role: string) {
        return this.userResolverFacade.getUsersByRole(role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "activeUsers" })
    async getActiveUsers() {
        return this.userResolverFacade.getActiveUsers()
    }

    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userResolverFacade.resolveReference(reference)
    }
}
