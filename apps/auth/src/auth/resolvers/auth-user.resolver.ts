import { Args, ID, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { AuthUser } from "../models"
import { AuthResolver } from "../auth.resolver"
import { UpdateUserInput, ChangePasswordInput } from "../dto/auth.input"
import { Mutation } from "@nestjs/graphql"

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
    async changePassword(
        @Args("id", { type: () => ID }) id: string,
        @Args("input") input: ChangePasswordInput,
    ): Promise<boolean> {
        return this.authResolver.changePassword(id, input)
    }
}
