import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { CampaignModule } from "./campaign/campaign.module"
import { SentryModule } from "@libs/observability/sentry.module"
import { CampaignCategoryModule } from "./campaign-category/campaign-category.module"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { ScheduleModule } from "@nestjs/schedule"
import { User } from "./shared/model/user.model"
import { EnvModule } from "@libs/env/env.module"
import { PostModule } from "./post/post.module"
import { DonationModule } from "./donation/donation.module"
import { OpenSearchModule } from "@libs/aws-opensearch"
import { SqsModule } from "@libs/aws-sqs"
import { RedisModule } from "@libs/redis"
import { GrpcModule } from "@libs/grpc"
import { VietQRModule } from "@libs/vietqr"
import { QueueWorkerService } from "./workers/queue-worker.service"

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
        ScheduleModule.forRoot(),
        GrpcModule,
        CampaignModule,
        CampaignCategoryModule,
        PostModule,
        DonationModule,
        SqsModule,
        OpenSearchModule,
        RedisModule.registerAsync(),
        VietQRModule,
    ],
    controllers: [],
    providers: [QueueWorkerService],
})
export class AppModule {}
