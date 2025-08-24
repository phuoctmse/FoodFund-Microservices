import { Args, ID, Query, Resolver, ResolveReference, Mutation } from '@nestjs/graphql';
import { User } from '../models/user.model';
import { UsersSubgraphService } from '../service/users-subgraph.service';
import { CreateUserInput, UpdateUserInput } from '../dto/user.input';

@Resolver((of) => User)
export class UsersResolver {
    constructor(private usersService: UsersSubgraphService) { }

    @Query((returns) => User)
    async getUser(@Args({ name: 'id', type: () => ID }) id: string): Promise<User> {
        return this.usersService.findById(id);
    }

    @Query((returns) => [User])
    async getAllUsers(): Promise<User[]> {
        return this.usersService.findAll();
    }

    @Query((returns) => User, { nullable: true })
    async getUserByEmail(@Args('email') email: string): Promise<User | null> {
        return this.usersService.findByEmail(email);
    }

    @Query((returns) => User, { nullable: true })
    async getUserByUsername(@Args('username') username: string): Promise<User | null> {
        return this.usersService.findByUsername(username);
    }

    @Mutation((returns) => User)
    async createUser(@Args('input') input: CreateUserInput): Promise<User> {
        return this.usersService.createUser(input);
    }

    @Mutation((returns) => User)
    async updateUser(
        @Args({ name: 'id', type: () => ID }) id: string,
        @Args('input') input: UpdateUserInput
    ): Promise<User> {
        return this.usersService.updateUser(id, input);
    }

    @Mutation((returns) => Boolean)
    async deleteUser(@Args({ name: 'id', type: () => ID }) id: string): Promise<boolean> {
        return this.usersService.deleteUser(id);
    }

    @ResolveReference()
    resolveReference(reference: { __typename: string; id: string }): Promise<User> {
        return this.usersService.findById(reference.id);
    }
}
