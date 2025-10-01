import { Resolver, ResolveReference } from "@nestjs/graphql"
import { UserRef } from "../../shared/reference/user.ref"

@Resolver(() => UserRef)
export class UserRefResolver {
    @ResolveReference()
    resolveReference(reference: { __typename: string; id: string }): UserRef {
        return {
            __typename: "User",
            id: reference.id,
        } as UserRef
    }
}
