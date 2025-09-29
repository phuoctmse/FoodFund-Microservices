import { Resolver, Mutation, Args, ID, Context } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { UserProfileSchema } from "libs/databases/prisma/schemas"
import { UpdateUserInput } from "../../dto/user.input"
import { UserMutationService } from "../../services/common/user-mutation.service"
import { UserQueryService } from "../../services/common/user-query.service"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"

@Resolver(() => UserProfileSchema)
export class UserMutationResolver {
    constructor(
        private readonly userMutationService: UserMutationService,
        private readonly userQueryService: UserQueryService,
    ) {}

    @Mutation(() => UserProfileSchema)
    @UseGuards(CognitoGraphQLGuard)
    async updateUser(
        @Args("updateUserProfileInput", new ValidationPipe())
            updateUserInput: UpdateUserInput,
        @Context() context: any,
    ) {
        const cognitoId = context.req.user?.username
        if (!cognitoId) throw new Error("Unauthorized: missing Cognito ID")
        
        const user = await this.userQueryService.findUserByCognitoId(cognitoId)
        if (!user) throw new Error("User not found")
        
        return await this.userMutationService.updateUser(user.id, updateUserInput)
    }

    @Mutation(() => UserProfileSchema)
    async deleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userMutationService.deleteUser(id)
    }

    @Mutation(() => UserProfileSchema)
    async softDeleteUser(@Args("id", { type: () => ID }) id: string) {
        return this.userMutationService.softDeleteUser(id)
    }
}