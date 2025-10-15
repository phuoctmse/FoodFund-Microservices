import { SentryModule } from "@libs/observability/sentry.module"
import { Module } from "@nestjs/common"
import {
    CampaignModule,
    CampaignRepository,
    CampaignService,
    PrismaCampaignService,
} from "../campaign"
import { PrismaClient } from "../generated/campaign-client"
import { PostRepository } from "./repositories/post.repository"
import { PostService } from "./services/post.service"
import { PostQueryResolver } from "./resolvers/queries/post-query.resolver"
import { PostMutationResolver } from "./resolvers/mutations/post-mutation.resolver"
import { PostCommentRepository, PostLikeRepository } from "./repositories"
import { PostCommentService, PostLikeService } from "./services"
import { PostLikeQueryResolver } from "./resolvers/queries/post-like-query.resolver"
import { PostLikeMutationResolver } from "./resolvers/mutations/post-like-mutation.resolver"
import { PostCommentQueryResolver } from "./resolvers/queries/post-comment-query.resolver"
import { PostCommentMutationResolver } from "./resolvers/mutations/post-comment-mutation.resolver"
import { SpacesUploadService } from "@libs/s3-storage/spaces-upload.service"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { CampaignCategoryModule } from "../campaign-category/campaign-category.module"
import { AuthorizationService } from "../shared"
import { PostLikeDataLoader } from "./dataloaders/post-like.dataloader"

@Module({
    imports: [
        SentryModule,
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        CampaignCategoryModule,
        CampaignModule,
    ],
    providers: [
        PrismaCampaignService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaCampaignService) => service["client"],
            inject: [PrismaCampaignService],
        },
        PostRepository,
        PostLikeRepository,
        PostCommentRepository,
        CampaignRepository,
        PostService,
        PostLikeService,
        PostCommentService,
        CampaignService,
        SpacesUploadService,
        AuthorizationService,
        PostQueryResolver,
        PostMutationResolver,
        PostLikeQueryResolver,
        PostLikeMutationResolver,
        PostCommentQueryResolver,
        PostCommentMutationResolver,
        PostLikeDataLoader,
    ],
    exports: [
        PostService,
        PostLikeService,
        PostCommentService,
        PostRepository,
        PostLikeRepository,
        PostCommentRepository,
    ],
})
export class PostModule {}
