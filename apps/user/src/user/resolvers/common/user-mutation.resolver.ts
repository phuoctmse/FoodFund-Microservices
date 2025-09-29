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

}