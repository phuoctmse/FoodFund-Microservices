import { Resolver, Query, Mutation, Args, ID, ResolveReference } from "@nestjs/graphql"
import { ValidationPipe } from "@nestjs/common"
import { UserService } from "../user.service"
import { CreateUserInput, UpdateUserInput } from "../dto/user.input"
import { UserProfileSchema, Role } from "libs/databases/prisma/schemas"

@Resolver(() => UserProfileSchema)
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    // Queries
    @Query(() => [UserProfileSchema], { name: "users" })
    async findAllUsers(
        @Args("skip", { type: () => Number, nullable: true }) skip?: number,
        @Args("take", { type: () => Number, nullable: true }) take?: number
    ) {
        return this.userService.findAllUsers(skip, take)
    }

    @Query(() => UserProfileSchema, { name: "user" })
    async findUserById(@Args("id", { type: () => ID }) id: string) {
        return this.userService.findUserById(id)
    }

    @Query(() => UserProfileSchema, { name: "userByEmail" })
    async findUserByEmail(@Args("email") email: string) {
        return this.userService.findUserByEmail(email)
    }

    @Query(() => UserProfileSchema, { name: "userByUsername" })
    async findUserByUsername(@Args("user_name") user_name: string) {
        return this.userService.findUserByUsername(user_name)
    }

    @Query(() => [UserProfileSchema], { name: "searchUsers" })
    async searchUsers(
        @Args("searchTerm") searchTerm: string,
        @Args("role", { nullable: true }) role?: string
    ) {
        return this.userService.searchUsers(searchTerm, role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "usersByRole" })
    async getUsersByRole(@Args("role") role: string) {
        return this.userService.getUsersByRole(role as Role)
    }

    @Query(() => [UserProfileSchema], { name: "activeUsers" })
    async getActiveUsers() {
        return this.userService.getActiveUsers()
    }

    // Mutations
    @Mutation(() => UserProfileSchema)
    async createUser(
        @Args("createUserInput", new ValidationPipe()) createUserInput: CreateUserInput
    ) {
        return this.userService.createUser(createUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async updateUser(
        @Args("id", { type: () => ID }) id: string,
        @Args("updateUserInput", new ValidationPipe()) updateUserInput: UpdateUserInput
    ) {
        return this.userService.updateUser(id, updateUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async deleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userService.deleteUser(id)
    }

    @Mutation(() => UserProfileSchema)
    async softDeleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userService.softDeleteUser(id)
    }

    // GraphQL Federation resolver
    @ResolveReference()
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userService.resolveReference(reference)
    }
}
