import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { EnvModule } from "@libs/env/env.module"
import { AuthLibModule } from "@libs/auth"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { GrpcModule } from "@libs/grpc"
import {
    AuthRegistrationService,
    AuthAuthenticationService,
    AuthUserService,
    AuthAdminService,
} from "./application/services"
import {
    AuthRegistrationResolver,
    AuthAuthenticationResolver,
    AuthUserResolver,
    AdminResolver,
} from "./presentation/graphql/resolvers"
import { AuthGrpcController } from "./infrastructure/messaging/grpc"
import { HealthController } from "./presentation/http/controllers"

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
        AuthRegistrationResolver,
        AuthAuthenticationResolver,
        AuthUserResolver,
        AdminResolver,

        // Services (Application Layer)
        AuthRegistrationService,
        AuthAuthenticationService,
        AuthUserService,
        AuthAdminService,
    ],
})
export class AppModule {}
