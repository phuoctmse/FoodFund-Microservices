import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { EnvModule } from "@libs/env/env.module"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "@libs/aws-cognito"

// Infrastructure
import { PrismaClient } from "./generated/user-client"
import { PrismaUserService } from "./infrastructure/database/prisma-user.service"
import {
    UserRepositoryAdapter,
    OrganizationRepositoryAdapter,
} from "./infrastructure/database/repositories"

// Application
import {
    UserApplicationService,
    OrganizationApplicationService,
} from "./application/services"
import { UserMapper } from "./shared/mappers"

// Presentation
import {
    UserQueryResolver,
    UserMutationResolver,
    UserAdminResolver,
    UserDonorResolver,
    UserFundraiserResolver,
    UserGrpcController,
    HealthController,
} from "./presentation"

// Register GraphQL Enums
import "./presentation/graphql/enums"
import { GrpcModule } from "@libs/grpc"

@Module({
    imports: [
        EnvModule.forRoot(),
        GrpcModule,
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "user-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),
        GraphQLSubgraphModule.forRoot({
            debug: envConfig().nodeEnv === "development",
            playground: envConfig().nodeEnv === "development",
            federationVersion: 2,
        }),
        AwsCognitoModule.forRoot(), // Add AWS Cognito for updateMyProfile
    ],
    controllers: [HealthController],
    providers: [
        // Prisma
        PrismaUserService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaUserService) => service["client"],
            inject: [PrismaUserService],
        },

        // Mappers
        UserMapper,

        // Repositories
        {
            provide: "IUserRepository",
            useClass: UserRepositoryAdapter,
        },
        {
            provide: "IOrganizationRepository",
            useClass: OrganizationRepositoryAdapter,
        },

        // Application Services
        UserApplicationService,
        OrganizationApplicationService,

        // GraphQL Resolvers
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,
        UserDonorResolver,
        UserFundraiserResolver,

        // gRPC Controller
        UserGrpcController,
    ],
    exports: [UserApplicationService, OrganizationApplicationService],
})
export class AppModule {}
