import { Module } from "@nestjs/common"
import { AuthSubgraphModule } from "./auth/auth-subgraph.module"
import { EnvModule } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"


@Module({
    imports: [
        EnvModule.forRoot(),
        // Sentry for error tracking & performance monitoring
        SentryModule.forRoot({
            dsn: process.env.SENTRY_DSN || "",
            serviceName: "auth-service",
            environment: process.env.NODE_ENV || "development",
            release: "1.0.0",
            enableTracing: true,
        }),

        AuthSubgraphModule
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
