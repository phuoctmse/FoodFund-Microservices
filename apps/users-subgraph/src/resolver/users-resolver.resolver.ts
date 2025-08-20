import { Args, ID, Query, Resolver, ResolveReference } from '@nestjs/graphql';
import { User } from '../users/models/user.model';
import { UsersSubgraphService } from '../users/users-subgraph.service';

@Resolver((of) => User)
export class UsersResolverResolver {
    constructor(private usersService: UsersSubgraphService) { }

    @Query((returns) => User)
    getUser(@Args({ name: 'id', type: () => ID }) id: number): User {
        return this.usersService.findById(id);
    }

    @ResolveReference()
    resolveReference(reference: { __typename: string; id: number }): User {
        return this.usersService.findById(reference.id);
    }
}
