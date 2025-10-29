import { Module } from "@nestjs/common"
import { AuthSubgraphModule } from "./auth/auth-subgraph.module"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { EnvModule } from "@libs/env/env.module"

@Module({
    imports: [
        EnvModule.forRoot(),
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
