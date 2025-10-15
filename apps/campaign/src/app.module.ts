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
        CampaignModule,
        CampaignCategoryModule,
        PostModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
