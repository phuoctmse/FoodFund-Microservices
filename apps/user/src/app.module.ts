import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { UserModule } from "./user/user.module"
import { EnvModule } from "@libs/env/env.module"
import { CloudWatchModule } from "@libs/aws-cloudwatch"

@Module({
    imports: [
        EnvModule.forRoot(),
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "user-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),
        CloudWatchModule,
        UserModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
