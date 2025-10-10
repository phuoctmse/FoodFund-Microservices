import { Module } from "@nestjs/common"
import { envConfig, EnvModule } from "libs/env"
import { CampaignModule } from "./campaign/campaign.module"
import { PrismaModule } from "@libs/databases"
import { SentryModule } from "@libs/observability/sentry.module"
import { CampaignCategoryModule } from "./campaign-category/campaign-category.module"
import { UserRef } from "./shared/reference/user.ref"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { ScheduleModule } from "@nestjs/schedule"

@Module({
    imports: [
        GraphQLSubgraphModule.forRoot({
            debug: process.env.NODE_ENV === "development",
            playground: process.env.NODE_ENV === "development",
            federationVersion: 2,
            path: "/graphql",
            buildSchemaOptions: {
                orphanedTypes: [UserRef],
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
        PrismaModule.forRoot({
            isGlobal: true,
            enableLogging: process.env.NODE_ENV === "development",
            logLevel:
                process.env.NODE_ENV === "development"
                    ? ["info", "warn", "error"]
                    : ["error"],
            datasourceUrl: process.env.CAMPAIGN_DATABASE_URL,
        }),
        ScheduleModule.forRoot(),
        CampaignModule,
        CampaignCategoryModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
