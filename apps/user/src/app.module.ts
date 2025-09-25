import { Module } from "@nestjs/common"
import { EnvModule, envConfig } from "libs/env"
import { PrismaModule } from "libs/databases/prisma"
import { SentryModule } from "libs/observability/sentry.module"
import { UserModule } from "./user/user.module"

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
        PrismaModule.forRoot({
            isGlobal: true,
            enableLogging: true,
            logLevel:
                process.env.NODE_ENV === "development"
                    ? ["query", "info", "warn", "error"]
                    : ["error"],
            datasourceUrl: process.env.USERS_DATABASE_URL,
        }),
        UserModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
