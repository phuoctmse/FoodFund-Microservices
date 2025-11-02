import { Resolver, Mutation, Args } from "@nestjs/graphql"
import { UseGuards, ValidationPipe, Logger } from "@nestjs/common"
import { CognitoGraphQLGuard, AwsCognitoService } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType, RequireRole } from "libs/auth"
import {
    UserApplicationService,
    OrganizationApplicationService,
} from "../../../application/services"
import { UserModel, LeaveOrganizationResponse } from "../models"
import { UpdateMyProfileInput } from "../inputs"
import { Role } from "../../../domain/enums"

/**
 * Presentation Resolver: User Mutation
 * Handles GraphQL mutations for user operations
 */
@Resolver(() => UserModel)
export class UserMutationResolver {
    private readonly logger = new Logger(UserMutationResolver.name)

    constructor(
        private readonly userApplicationService: UserApplicationService,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly organizationApplicationService: OrganizationApplicationService,
    ) {}

    @Mutation(() => UserModel)
    @UseGuards(CognitoGraphQLGuard)
    async updateMyProfile(
        @CurrentUser() user: CurrentUserType,
        @Args("input", new ValidationPipe()) input: UpdateMyProfileInput,
    ): Promise<UserModel> {
        if (!user) {
            throw new Error("User not authenticated")
        }

        const cognitoId = user.username as string
        if (!cognitoId) {
            throw new Error("User cognito_id not found")
        }

        // Get current user to find their internal ID
        const currentUser =
            await this.userApplicationService.getUserByCognitoId(cognitoId)
        if (!currentUser) {
            throw new Error("User not found")
        }

        // Update user profile in database
        const updatedUser = await this.userApplicationService.updateUser(
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
        }

        this.logger.log(`Profile updated successfully for user: ${cognitoId}`)
        return updatedUser
    }

    @Mutation(() => LeaveOrganizationResponse, {
        description:
            "Leave organization voluntarily (Staff only: KITCHEN_STAFF, DELIVERY_STAFF)",
    })
    @RequireRole(Role.KITCHEN_STAFF, Role.DELIVERY_STAFF)
    async leaveOrganization(@CurrentUser() user: CurrentUserType) {
        return this.organizationApplicationService.leaveOrganization(
            user.cognito_id,
        )
    }
}
