import { Resolver, Mutation, Args } from "@nestjs/graphql"
import { UseGuards, ValidationPipe, Logger } from "@nestjs/common"
import { UpdateMyProfileInput } from "../../dto/update-my-profile.input"
import { UserMutationService } from "../../services/common/user-mutation.service"
import { UserQueryService } from "../../services/common/user-query.service"
import { CognitoGraphQLGuard, AwsCognitoService } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType } from "libs/auth"
import { UserProfileSchema } from "../../models/user.model"

@Resolver(() => UserProfileSchema)
export class UserMutationResolver {
    private readonly logger = new Logger(UserMutationResolver.name)

    constructor(
        private readonly userMutationService: UserMutationService,
        private readonly userQueryService: UserQueryService,
        private readonly awsCognitoService: AwsCognitoService,
    ) {}

    @Mutation(() => UserProfileSchema)
    @UseGuards(CognitoGraphQLGuard)
    async updateMyProfile(
        @CurrentUser() user: CurrentUserType,
        @Args("input", new ValidationPipe()) input: UpdateMyProfileInput,
    ): Promise<UserProfileSchema> {
        if (!user) {
            throw new Error("User not authenticated")
        }

        const cognitoId = user.username as string
        if (!cognitoId) {
            throw new Error("User cognito_id not found")
        }

        // Get current user to find their internal ID
        const currentUser =
            await this.userQueryService.findUserByCognitoId(cognitoId)
        if (!currentUser) {
            throw new Error("User not found")
        }

        // Update user profile in database
        const updatedUser = await this.userMutationService.updateUser(
            currentUser.id,
            {
                full_name: input.full_name,
                avatar_url: input.avatar_url,
                phone_number: input.phone_number,
                address: input.address,
                bio: input.bio,
            },
        )

        // Update user attributes in AWS Cognito
        try {
            const cognitoUpdateParams: any = {}

            if (input.full_name) {
                cognitoUpdateParams["name"] = input.full_name
            }

            if (input.phone_number) {
                cognitoUpdateParams["phone_number"] = input.phone_number
            }

            // Only update Cognito if there are attributes to update
            if (Object.keys(cognitoUpdateParams).length > 0) {
                await this.awsCognitoService.updateUserAttributes(
                    cognitoId,
                    cognitoUpdateParams,
                )
            }
        } catch (cognitoError) {
            // Log error but don't fail the entire operation since DB update succeeded
            this.logger.error(
                `Failed to update AWS Cognito attributes for user ${cognitoId}:`,
                cognitoError,
            )
            // Note: You might want to implement a retry mechanism or compensating transaction here
        }

        this.logger.log(`Profile updated successfully for user: ${cognitoId}`)
        return updatedUser
    }
}
