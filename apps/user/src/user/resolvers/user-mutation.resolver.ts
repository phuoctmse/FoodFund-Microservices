import { Resolver, Mutation, Args, ID } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { UserProfileSchema } from "libs/databases/prisma/schemas"
import { CreateUserInput, UpdateUserInput } from "../dto/user.input"
import { UserResolver as UserResolverFacade } from "../user.resolver"

@Resolver(() => UserProfileSchema)
export class UserMutationResolver {
    constructor(private readonly userResolverFacade: UserResolverFacade) {}

    @Mutation(() => UserProfileSchema)
    async createUser(
        @Args("createUserInput", new ValidationPipe()) createUserInput: CreateUserInput
    ) {
        return this.userResolverFacade.createUser(createUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async updateUser(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateUserInput", new ValidationPipe()) updateUserInput: UpdateUserInput
    ) {
        return this.userResolverFacade.updateUser(id, updateUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async deleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userResolverFacade.deleteUser(id)
    }

    @Mutation(() => UserProfileSchema)
    async softDeleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userResolverFacade.softDeleteUser(id)
    }
}