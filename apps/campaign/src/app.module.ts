import { Module } from "@nestjs/common"
import { envConfig, EnvModule } from "libs/env"
import { CampaignModule } from "./campaign/campaign.module"
import { PrismaModule } from "@libs/databases"
import { SentryModule } from "@libs/observability/sentry.module"

@Module({
    imports: [
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
            enableLogging: true,
            logLevel:
                process.env.NODE_ENV === "development"
                    ? ["query", "info", "warn", "error"]
                    : ["error"],
            datasourceUrl: process.env.CAMPAIGN_DATABASE_URL,
        }),
        CampaignModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
