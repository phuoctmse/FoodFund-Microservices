import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { DatadogModule } from "@libs/observability/datadog"
import { EnvModule } from "@libs/env/env.module"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { GrpcModule } from "@libs/grpc"
import { SpacesUploadService } from "@libs/s3-storage"
import { PrismaClient } from "./generated/user-client"
import {
    UserAdminService,
    OrganizationService,
    DataLoaderFactory,
    DataLoaderService,
    DonorService,
    UserQueryService,
    UserMutationService,
    WalletService,
} from "./application/services"
import { WalletTransactionService } from "./application/services/common/wallet-transaction.service"
import { BadgeService, UserBadgeService } from "./application/services/badge"
import { BadgeEmailService } from "./application/services/badge/badge-email.service"
import { BrevoEmailService } from "@libs/email"
import {
    UserRepository,
    OrganizationRepository,
    WalletRepository,
    BadgeRepository,
    UserBadgeRepository,
} from "./application/repositories"
import { PrismaUserService } from "./infrastructure/database"
import { UserGrpcController } from "./presentation/grpc"
import {
    UserQueryResolver,
    UserMutationResolver,
    UserAdminResolver,
    OrganizationQueryResolver,
    OrganizationAdminResolver,
    AdminWalletResolver,
    DonorProfileResolver,
    FundraiserProfileResolver,
    FundraiserWalletResolver,
    WalletQueryResolver,
    WalletFieldResolver,
    BadgeQueryResolver,
    BadgeMutationResolver,
    OrganizationMutationResolver,
} from "./presentation/graphql/resolvers"
import { HealthController } from "./presentation/http/controllers"

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
        DatadogModule.forRoot({
            serviceName: "user-service",
            env: envConfig().nodeEnv,
            version: process.env.SERVICE_VERSION || "1.0.0",
        }),
        GrpcModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
            federationVersion: 2,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
    ],
    controllers: [
        // Presentation - HTTP Controllers
        HealthController,

        // Presentation - gRPC Controller
        UserGrpcController,
    ],
    providers: [
        // Infrastructure - Database
        PrismaUserService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaUserService) => service["client"],
            inject: [PrismaUserService],
        },

        // Domain - Repositories
        UserRepository,
        OrganizationRepository,
        WalletRepository,
        BadgeRepository,
        UserBadgeRepository,

        // Application - Use Cases
        UserAdminService,
        OrganizationService,
        DataLoaderFactory,
        DataLoaderService,
        DonorService,
        UserQueryService,
        UserMutationService,
        WalletService,
        WalletTransactionService,
        BadgeService,
        UserBadgeService,
        BadgeEmailService,
        BrevoEmailService,
        SpacesUploadService,

        // Presentation - Resolvers
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,
        OrganizationQueryResolver,
        OrganizationAdminResolver,
        AdminWalletResolver,
        DonorProfileResolver,
        FundraiserProfileResolver,
        FundraiserWalletResolver,
        WalletQueryResolver,
        WalletFieldResolver,
        BadgeQueryResolver,
        BadgeMutationResolver,
        OrganizationMutationResolver,
    ],
    exports: [UserRepository],
})
export class AppModule {}
