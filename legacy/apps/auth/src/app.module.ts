import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { DatadogModule } from "@libs/observability/datadog"
import { EnvModule } from "@libs/env/env.module"
import { AuthLibModule } from "@libs/auth"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { GrpcModule } from "@libs/grpc"
import {
    RegistrationService,
    AuthenticationService,
    UserService,
    AuthAdminService,
} from "./application/services"
import {
    RegistrationResolver,
    AuthenticationResolver,
    UserResolver,
} from "./presentation/graphql/resolvers"
import { HealthController } from "./presentation/http/controllers"
import { AuthGrpcController } from "./presentation/grpc"
import { USER_SERVICE_TOKEN } from "./domain/interfaces"
import { UserServiceGrpcAdapter } from "./infrastructure/adapters"

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
        DatadogModule.forRoot({
            serviceName: "auth-service",
            env: envConfig().nodeEnv,
            version: process.env.SERVICE_VERSION || "1.0.0",
        }),
        GrpcModule,
        AuthLibModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: true,
            mockMode: false,
        }),
    ],
    controllers: [
        HealthController,
        AuthGrpcController, // gRPC Controller (Infrastructure Layer)
    ],
    providers: [
        // Resolvers (Presentation Layer)
        RegistrationResolver,
        AuthenticationResolver,
        UserResolver,

        // Services (Application Layer)
        RegistrationService,
        AuthenticationService,
        UserService,
        AuthAdminService,

        // Infrastructure Adapters (Dependency Injection)
        {
            provide: USER_SERVICE_TOKEN,
            useClass: UserServiceGrpcAdapter,
        },
    ],
})
export class AppModule {}
