import { Resolver, Mutation, Args } from "@nestjs/graphql"
import { UseGuards, ValidationPipe } from "@nestjs/common"
import { RequireRole, CurrentUser, CurrentUserType } from "@libs/auth"
import { CognitoGraphQLGuard } from "@libs/aws-cognito"
import { Role } from "@libs/databases"
import { SpacesUploadService } from "@libs/s3-storage"
import { BadgeService, UserBadgeService } from "../../../../application/services/badge"
import { Badge, UserBadge } from "../../../../domain/entities/badge.model"
import {
    CreateBadgeInput,
    UpdateBadgeInput,
    AwardBadgeInput,
} from "../../../../application/dtos/badge.input"
import { GenerateBadgeUploadUrlInput } from "../../../../application/dtos/badge-upload.input"
import { BadgeUploadResponse } from "../../../../application/dtos/badge-upload.output"

@Resolver(() => Badge)
@UseGuards(CognitoGraphQLGuard)
export class BadgeMutationResolver {
    private readonly resource = "badge-icons"

    constructor(
                private readonly badgeService: BadgeService,
                private readonly userBadgeService: UserBadgeService,
                private readonly spacesUploadService: SpacesUploadService,
    ) {}

    @Mutation(() => BadgeUploadResponse, {
        name: "generateBadgeUploadUrl",
        description:
            "Generate presigned upload URL for badge icon. Admin only. " +
            "Upload the file using the returned uploadUrl, then use the cdnUrl as icon_url in createBadge.",
    })
    @RequireRole(Role.ADMIN)
    async generateBadgeUploadUrl(
        @Args(
            "input",
            { type: () => GenerateBadgeUploadUrlInput },
            new ValidationPipe(),
        )
            input: GenerateBadgeUploadUrlInput,
        @CurrentUser() user: CurrentUserType,
    ): Promise<BadgeUploadResponse> {
        const uploadResults =
            await this.spacesUploadService.generateBatchImageUploadUrls(
                user.id,
                this.resource,
                1,
                [input.fileType || "png"],
            )

        const uploadUrl = uploadResults[0]

        return {
            success: true,
            message: "Generated badge icon upload URL successfully",
            uploadUrl: {
                uploadUrl: uploadUrl.uploadUrl,
                fileKey: uploadUrl.fileKey,
                cdnUrl: uploadUrl.cdnUrl,
                expiresAt: uploadUrl.expiresAt,
                fileType: uploadUrl.fileType as string,
            },
            instructions: `
1. Upload the badge icon using PUT request to the uploadUrl
2. Set required headers:
   - Content-Type: matching the file type (e.g., image/png)
   - x-amz-acl: public-read
3. After upload completes, use the cdnUrl as the 'icon_url' field in createBadge mutation
4. Upload URL expires in 5 minutes

Recommended badge icon specs:
- Format: PNG with transparency (or SVG)
- Size: 256x256px or 512x512px
- Style: Consistent across all badges
      `.trim(),
        }
    }

    @Mutation(() => Badge, { description: "Create a new badge (Admin only)" })
    @RequireRole(Role.ADMIN)
    async createBadge(@Args("input") input: CreateBadgeInput) {
        return this.badgeService.createBadge(input)
    }

    @Mutation(() => Badge, { description: "Update badge (Admin only)" })
    @RequireRole(Role.ADMIN)
    async updateBadge(
        @Args("id") id: string,
        @Args("input") input: UpdateBadgeInput,
    ) {
        return this.badgeService.updateBadge(id, input)
    }

    @Mutation(() => Boolean, { description: "Delete badge (Admin only)" })
    @RequireRole(Role.ADMIN)
    async deleteBadge(@Args("id") id: string) {
        await this.badgeService.deleteBadge(id)
        return true
    }

    @Mutation(() => UserBadge, {
        description: "Award badge to a donor (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async awardBadge(@Args("input") input: AwardBadgeInput) {
        return this.userBadgeService.awardBadge(input.userId, input.badgeId)
    }

    @Mutation(() => Boolean, {
        description: "Revoke badge from a user (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async revokeBadge(@Args("userId") userId: string) {
        await this.userBadgeService.revokeBadge(userId)
        return true
    }
}
