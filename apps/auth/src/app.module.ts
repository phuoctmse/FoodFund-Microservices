import { Module } from "@nestjs/common"
import { AuthSubgraphModule } from "./auth/auth-subgraph.module"
import { EnvModule, envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"

@Module({
    imports: [
        EnvModule.forRoot(),
        // Sentry for error tracking & performance monitoring
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "auth-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),

        AuthSubgraphModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
