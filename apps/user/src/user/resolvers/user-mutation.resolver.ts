import { Resolver, Mutation, Args, ID, Context } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { UserProfileSchema } from "libs/databases/prisma/schemas"
import { CreateUserInput, UpdateUserInput } from "../dto/user.input"
import { UserResolver } from "../user.resolver"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => UserProfileSchema)
export class UserMutationResolver {
    constructor(private readonly userResolver: UserResolver) {}

    @Mutation(() => UserProfileSchema)
    @UseGuards(CognitoGraphQLGuard)
    async updateUser(
        @Args("updateUserProfileInput", new ValidationPipe())
            updateUserInput: UpdateUserInput,
        @Context() context: any,
    ) {
        const cognitoId = context.req.user?.username
        if (!cognitoId) throw new Error("Unauthorized: missing Cognito ID")
        const user = await this.userResolver.findUserByCognitoId(cognitoId)
        if (!user) throw new Error("User not found")
        return await this.userResolver.updateUser(user.id, updateUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async deleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userResolver.deleteUser(id)
    }

    @Mutation(() => UserProfileSchema)
    async softDeleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userResolver.softDeleteUser(id)
    }
}
