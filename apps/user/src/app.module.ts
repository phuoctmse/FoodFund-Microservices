import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { DatadogModule } from "@libs/observability/datadog"
import { EnvModule } from "@libs/env/env.module"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { GrpcModule } from "@libs/grpc"
import { PrismaClient } from "./generated/user-client"
import {
    UserAdminService,
    OrganizationService,
    DataLoaderFactory,
    DataLoaderService,
    DonorService,
    FundraiserService,
    KitchenStaffService,
    DeliveryStaffService,
    UserQueryService,
    UserMutationService,
    WalletService,
} from "./application/services"
import { WalletTransactionService } from "./application/services/common/wallet-transaction.service"
import {
    UserRepository,
    OrganizationRepository,
    UserAdminRepository,
    UserCommonRepository,
    KitchenStaffRepository,
    FundraiserRepository,
    DeliveryStaffRepository,
    WalletRepository,
} from "./application/repositories"
import { PrismaUserService } from "./infrastructure/database"
import { UserGrpcController } from "./presentation/grpc"
import {
    UserQueryResolver,
    UserMutationResolver,
    UserAdminResolver,
    AdminWalletResolver,
    DonorProfileResolver,
    KitchenStaffProfileResolver,
    FundraiserProfileResolver,
    FundraiserWalletResolver,
    DeliveryStaffProfileResolver,
    WalletQueryResolver,
    WalletFieldResolver,
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
        UserAdminRepository,
        UserCommonRepository,
        KitchenStaffRepository,
        FundraiserRepository,
        DeliveryStaffRepository,
        WalletRepository,

        // Application - Use Cases
        UserAdminService,
        OrganizationService,
        DataLoaderFactory,
        DataLoaderService,
        DonorService,
        FundraiserService,
        KitchenStaffService,
        DeliveryStaffService,
        UserQueryService,
        UserMutationService,
        WalletService,
        WalletTransactionService,

        // Presentation - Resolvers
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,
        AdminWalletResolver,
        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        FundraiserWalletResolver,
        DeliveryStaffProfileResolver,
        WalletQueryResolver,
        WalletFieldResolver,
    ],
    exports: [UserRepository],
})
export class AppModule {}
