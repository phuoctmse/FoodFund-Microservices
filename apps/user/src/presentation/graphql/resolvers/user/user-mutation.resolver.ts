import { Resolver, Mutation, Args } from "@nestjs/graphql"
import { UseGuards, ValidationPipe, Logger } from "@nestjs/common"

import { CognitoGraphQLGuard, AwsCognitoService } from "@libs/aws-cognito"
import { CurrentUser, CurrentUserType } from "libs/auth"
import {
    UpdateMyProfileInput,
    GenerateAvatarUploadUrlInput,
    AvatarUploadResponse,
} from "@app/user/src/application/dtos"
import {
    UserMutationService,
    UserQueryService,
} from "@app/user/src/application/services"
import { UserProfileSchema } from "@app/user/src/domain/entities"
import { SpacesUploadService } from "@libs/s3-storage"

@Resolver(() => UserProfileSchema)
export class UserMutationResolver {
    private readonly logger = new Logger(UserMutationResolver.name)
    private readonly resource = "user-avatars"

    constructor(
        private readonly userMutationService: UserMutationService,
        private readonly userQueryService: UserQueryService,
        private readonly awsCognitoService: AwsCognitoService,
        private readonly spacesUploadService: SpacesUploadService,
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

    @Mutation(() => AvatarUploadResponse, {
        name: "generateAvatarUploadUrl",
        description:
            "Generate presigned upload URL for user avatar. " +
            "Upload the file using the returned uploadUrl, then use the cdnUrl in updateMyProfile mutation.",
    })
    @UseGuards(CognitoGraphQLGuard)
    async generateAvatarUploadUrl(
        @Args(
            "input",
            { type: () => GenerateAvatarUploadUrlInput },
            new ValidationPipe(),
        )
            input: GenerateAvatarUploadUrlInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<AvatarUploadResponse> {
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

        // Generate upload URL
        const uploadResults =
            await this.spacesUploadService.generateBatchImageUploadUrls(
                currentUser.id,
                this.resource,
                1,
                [input.fileType || "png"],
            )

        const uploadUrl = uploadResults[0]

        this.logger.log(
            `Generated avatar upload URL for user: ${cognitoId}`,
        )

        return {
            success: true,
            message: "Generated avatar upload URL successfully",
            uploadUrl: {
                uploadUrl: uploadUrl.uploadUrl,
                fileKey: uploadUrl.fileKey,
                cdnUrl: uploadUrl.cdnUrl,
                expiresAt: uploadUrl.expiresAt,
                fileType: uploadUrl.fileType as string,
            },
            instructions: `
1. Upload the avatar image using PUT request to the uploadUrl
2. Set required headers:
   - Content-Type: matching the file type (e.g., image/png)
   - x-amz-acl: public-read
3. After upload completes, use the cdnUrl as the 'avatar_url' field in updateMyProfile mutation
4. Upload URL expires in 5 minutes
            `.trim(),
        }
    }
}
