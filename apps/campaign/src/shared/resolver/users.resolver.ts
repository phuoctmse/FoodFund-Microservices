import { Resolver, ResolveReference } from "@nestjs/graphql"
import { User } from "../model/user.model"

@Resolver(() => User)
export class UserResolver {
    @ResolveReference()
    resolveReference(reference: { __typename: string; id: string }): User {
        return {
            __typename: "User",
            id: reference.id,
        } as User
    }
}
