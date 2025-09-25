import { Args, ID, Query, Resolver, ResolveReference } from "@nestjs/graphql"
import { AuthUser } from "../models"
import { AuthResolver } from "../auth.resolver"

@Resolver(() => AuthUser)
export class AuthUserResolver {
    constructor(private authResolver: AuthResolver) {}

    @Query(() => AuthUser, { nullable: true })
    async getUserById(
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
}
