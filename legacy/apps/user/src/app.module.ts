import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { DatadogModule } from "@libs/observability/datadog"
import { EnvModule } from "@libs/env/env.module"
import { ScheduleModule } from "@nestjs/schedule"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { GrpcModule } from "@libs/grpc"
import { OpenSearchModule } from "@libs/aws-opensearch"
import { RedisModule } from "@libs/redis"
import { SpacesUploadService } from "@libs/s3-storage"
import { PrismaClient } from "./generated/user-client"
import { OrganizationSchema } from "./domain/entities"
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
import { WalletTransactionService } from "./application/services/wallet/wallet-transaction.service"
import { WalletTransactionSearchService } from "./application/services/wallet/wallet-transaction-search.service"
import { BadgeService, UserBadgeService, BadgeMilestoneService } from "./application/services/badge"
import { BadgeEmailService } from "./application/services/badge/badge-email.service"
import { SystemConfigService } from "./application/services/system-config/system-config.service"
import { BrevoEmailService } from "@libs/email"
import {
    UserRepository,
    OrganizationRepository,
    WalletRepository,
    BadgeRepository,
    UserBadgeRepository,
    SystemConfigRepository,
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
    StaffProfileResolver,
    FundraiserWalletResolver,
    WalletQueryResolver,
    WalletFieldResolver,
    BadgeQueryResolver,
    BadgeMutationResolver,
    BadgeFieldResolver,
    OrganizationMutationResolver,
    OrganizationReferenceResolver,
    SystemConfigResolver,
} from "./presentation/graphql/resolvers"
import { HealthController } from "./presentation/http/controllers"

import { WalletTransactionConsumer } from "./application/handlers/kafka/wallet-transaction.consumer"

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
        OpenSearchModule,
        RedisModule.registerAsync(),
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
            federationVersion: 2,
            buildSchemaOptions: {
                orphanedTypes: [OrganizationSchema],
            },
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        ScheduleModule.forRoot(),
    ],
    controllers: [
        // Presentation - HTTP Controllers
        HealthController,

        // Presentation - gRPC Controller
        UserGrpcController,

        // Kafka Consumers
        WalletTransactionConsumer,
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
        SystemConfigRepository,

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
        WalletTransactionSearchService,
        BadgeService,
        UserBadgeService,
        BadgeMilestoneService,
        BadgeEmailService,
        BrevoEmailService,
        SpacesUploadService,
        SystemConfigService,

        // Presentation - Resolvers
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,
        OrganizationQueryResolver,
        OrganizationAdminResolver,
        AdminWalletResolver,
        DonorProfileResolver,
        FundraiserProfileResolver,
        StaffProfileResolver,
        FundraiserWalletResolver,
        WalletQueryResolver,
        WalletFieldResolver,
        BadgeQueryResolver,
        BadgeMutationResolver,
        BadgeFieldResolver,
        OrganizationMutationResolver,
        OrganizationReferenceResolver,
        SystemConfigResolver,
    ],
    exports: [UserRepository],
})
export class AppModule { }
