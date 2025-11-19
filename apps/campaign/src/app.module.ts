import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "@libs/observability/sentry.module"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { ScheduleModule } from "@nestjs/schedule"
import { User } from "./shared/model/user.model"
import { EnvModule } from "@libs/env/env.module"
import { OpenSearchModule } from "@libs/aws-opensearch"
import { GrpcModule } from "@libs/grpc"
import { QueueModule, QUEUE_NAMES, BullDatadogModule } from "@libs/queue"
import { BullBoardModule } from "@bull-board/nestjs"
import { ExpressAdapter } from "@bull-board/express"
import { VietQRModule } from "@libs/vietqr"
import { DatadogModule } from "@libs/observability"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { EventEmitterModule } from "@nestjs/event-emitter"
import { PrismaCampaignService } from "./infrastructure/database/prisma-campaign.service"
import { PrismaClient } from "./generated/campaign-client"
import { SpacesUploadService } from "@libs/s3-storage"
import { CampaignCacheService } from "./application/services/campaign/campaign-cache.service"
import { CampaignService } from "./application/services/campaign/campaign.service"
import { CampaignSettlementService } from "./application/services/campaign/campaign-settlement.service"
import {
    AuthorizationService,
    UserClientService,
    UserDataLoader,
    UserResolver,
} from "./shared"
import { CampaignQueryResolver } from "./presentation/graphql/campaign/queries"
import { CampaignStatsQueryResolver } from "./presentation/graphql/campaign/queries/campaign-stats-query.resolver"
import { CampaignMutationResolver } from "./presentation/graphql/campaign/mutations"
import { CampaignRepository } from "./application/repositories/campaign.repository"
import { CampaignStatusJob } from "./application/workers/campaign/campaign-status.job"
import { HealthController } from "./presentation/http/controllers/campaign/health.controller"
import { CampaignGrpcService } from "./presentation/grpc/campaign/campaign-grpc.service"
import { CampaignCategoryCacheService } from "./application/services/campaign-category/campaign-category-cache.service"
import { CampaignCategoryService } from "./application/services/campaign-category/campaign-category.service"
import { CampaignCategoryRepository } from "./application/repositories/campaign-category.repository"
import { CampaignCategoryQueryResolver } from "./presentation/graphql/campaign-category/queries"
import { CampaignCategoryMutationResolver } from "./presentation/graphql/campaign-category/mutations"
import { CampaignPhaseService } from "./application/services/campaign-phase/campaign-phase.service"
import { CampaignPhaseRepository } from "./application/repositories/campaign-phase.repository"
import { CampaignPhaseQueryResolver } from "./presentation/graphql/campaign-phase/queries"
import { CampaignPhaseMutationResolver } from "./presentation/graphql/campaign-phase/mutations"
import { AuthLibModule } from "@libs/auth"
import { DonationWebhookController } from "./presentation/http/controllers/donation/donation-webhook.controller"
import { SepayWebhookController } from "./presentation/http/controllers/donation/sepay-webhook.controller"
import { DonorService } from "./application/services/donation/donor.service"
import { DonationWebhookService } from "./application/services/donation/donation-webhook.service"
import { SepayWebhookService } from "./application/services/donation/sepay-webhook.service"
import { DonationEmailService } from "./application/services/donation/donation-email.service"
import { PayosCleanupService } from "./application/services/donation/payos-cleanup.service"
import { DonationAdminService } from "./application/services/donation/admin"
import { DonorRepository } from "./application/repositories/donor.repository"
import { DonorMutationResolver } from "./presentation/graphql/donation/donor/mutations/donor-mutation.resolver"
import { DonorQueryResolver } from "./presentation/graphql/donation/donor/queries/donor-query.resolver"
import {
    AdminMutationResolver,
    AdminQueryResolver,
} from "./presentation/graphql/donation/admin"
import { PostRepository } from "./application/repositories/post.repository"
import { PostLikeRepository } from "./application/repositories/post-like.repository"
import { PostCommentRepository } from "./application/repositories/post-comment.repository"
import { PostService } from "./application/services/post/post.service"
import { PostLikeService } from "./application/services/post/post-like.service"
import { PostCommentService } from "./application/services/post/post-comment.service"
import {
    PostCommentQueryResolver,
    PostLikeQueryResolver,
    PostQueryResolver,
} from "./presentation/graphql/post/queries"
import {
    PostCommentMutationResolver,
    PostLikeMutationResolver,
    PostMutationResolver,
} from "./presentation/graphql/post/mutations"
import { PostLikeDataLoader } from "./application/dataloaders"
import { PostCacheService } from "./application/services/post/post-cache.service"
import { CampaignSchedulerService } from "./application/workers/campaign/schedulers"
import { PostLikeProcessor } from "./application/processors/post-like.processor"
import {
    NotificationCacheService,
    NotificationService,
} from "./application/services/notification"
import { NotificationRepository } from "./application/repositories/notification.repository"
import {
    CampaignApprovedBuilder,
    CampaignCancelledBuilder,
    CampaignCompletedBuilder,
    CampaignDonationReceivedBuilder,
    CampaignNewPostBuilder,
    CampaignRejectedBuilder,
    DeliveryTaskAssignedBuilder,
    IngredientRequestApprovedBuilder,
    NotificationBuilderFactory,
    PostCommentBuilder,
    PostLikeBuilder,
    PostReplyBuilder,
    SystemAnnouncementBuilder,
} from "./application/builders/notification"
import { NotificationQueryResolver } from "./presentation/graphql/notification/queries"
import { NotificationMutationResolver } from "./presentation/graphql/notification/mutations"
import { NotificationSubscriptionResolver } from "./presentation/graphql/notification/subscriptions"
import { BullModule, getQueueToken } from "@nestjs/bull"
import { PostLikeQueue } from "./application/workers/post-like/post-like.queue"
import { NotificationQueue } from "./application/workers/notification/notification.queue"
import { BrevoEmailService } from "@libs/email"
import { NotificationProcessor } from "./application/processors"
import {
    CampaignNotificationHandler,
    PostNotificationHandler,
} from "./application/handlers"
import { CampaignFollowerService } from "./application/services/campaign/campaign-follower.service"
import { Queue } from "bull"
import { PubSubModule } from "@libs/pubsub"

@Module({
    imports: [
        GraphQLSubgraphModule.forRoot({
            debug: process.env.NODE_ENV === "development",
            playground: process.env.NODE_ENV === "development",
            federationVersion: 2,
            path: "/graphql",
            buildSchemaOptions: {
                orphanedTypes: [User],
            },
        }),
        EnvModule.forRoot(),
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "campaign-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),
        DatadogModule.forRoot({
            serviceName: "campaign-service",
            env: envConfig().nodeEnv,
            version: process.env.SERVICE_VERSION || "1.0.0",
        }),
        AwsCognitoModule.forRoot({
            isGlobal: true,
            mockMode: false,
        }),
        ScheduleModule.forRoot(),
        GrpcModule,
        QueueModule,
        PubSubModule.forRoot(),
        BullBoardModule.forRoot({
            route: "/admin/queues",
            adapter: ExpressAdapter,
        }),
        BullDatadogModule.forRootAsync({
            imports: [
                BullModule.registerQueue({ name: QUEUE_NAMES.CAMPAIGN_JOBS }),
            ],
            inject: [getQueueToken(QUEUE_NAMES.CAMPAIGN_JOBS)],
            useFactory: (campaignQueue: Queue) => ({
                serviceName: "campaign-service",
                queues: [{ name: "campaign-jobs", queue: campaignQueue }],
            }),
        }),
        OpenSearchModule,
        VietQRModule,
        AuthLibModule,
        EventEmitterModule.forRoot({
            wildcard: false,
            delimiter: ".",
            newListener: false,
            removeListener: false,
            maxListeners: 10,
            verboseMemoryLeak: false,
            ignoreErrors: false,
        }),
    ],
    controllers: [
        HealthController,
        CampaignGrpcService,
        DonationWebhookController,
        SepayWebhookController,
    ],
    providers: [
        PrismaCampaignService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaCampaignService) => service["client"],
            inject: [PrismaCampaignService],
        },
        UserClientService,
        SpacesUploadService,
        AuthorizationService,
        CampaignSchedulerService,
        CampaignCacheService,
        CampaignService,
        CampaignSettlementService,
        CampaignFollowerService,
        CampaignCategoryCacheService,
        CampaignCategoryService,
        CampaignPhaseService,
        DonorService,
        DonationWebhookService,
        SepayWebhookService,
        DonationEmailService,
        PayosCleanupService,
        DonationAdminService,
        PostService,
        PostLikeService,
        PostCommentService,
        PostCacheService,
        NotificationService,
        NotificationCacheService,

        UserResolver,
        CampaignQueryResolver,
        CampaignStatsQueryResolver,
        CampaignMutationResolver,
        CampaignCategoryQueryResolver,
        CampaignCategoryMutationResolver,
        CampaignPhaseQueryResolver,
        CampaignPhaseMutationResolver,
        DonorMutationResolver,
        DonorQueryResolver,
        AdminQueryResolver,
        AdminMutationResolver,
        PostQueryResolver,
        PostMutationResolver,
        PostLikeQueryResolver,
        PostLikeMutationResolver,
        PostCommentQueryResolver,
        PostCommentMutationResolver,
        NotificationQueryResolver,
        NotificationMutationResolver,
        NotificationSubscriptionResolver,

        CampaignRepository,
        CampaignCategoryRepository,
        CampaignPhaseRepository,
        DonorRepository,
        PostRepository,
        PostLikeRepository,
        PostCommentRepository,
        NotificationRepository,

        CampaignStatusJob,
        PostLikeProcessor,
        NotificationProcessor,
        PostLikeQueue,
        NotificationQueue,

        UserDataLoader,
        PostLikeDataLoader,
        BrevoEmailService,

        CampaignNotificationHandler,
        PostNotificationHandler,

        NotificationBuilderFactory,
        CampaignApprovedBuilder,
        CampaignRejectedBuilder,
        CampaignCompletedBuilder,
        CampaignCancelledBuilder,
        CampaignDonationReceivedBuilder,
        CampaignNewPostBuilder,
        PostLikeBuilder,
        PostCommentBuilder,
        PostReplyBuilder,
        IngredientRequestApprovedBuilder,
        DeliveryTaskAssignedBuilder,
        SystemAnnouncementBuilder,
    ],
})
export class AppModule {}
