import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
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
} from "./application/services"
import {
    UserRepository,
    OrganizationRepository,
    UserAdminRepository,
    UserCommonRepository,
    KitchenStaffRepository,
    FundraiserRepository,
    DeliveryStaffRepository,
} from "./domain/repositories"
import { PrismaUserService } from "./infrastructure/database"
import { UserGrpcController } from "./infrastructure/grpc/user-grpc.controller"
import {
    UserQueryResolver,
    UserMutationResolver,
    UserAdminResolver,
    DonorProfileResolver,
    KitchenStaffProfileResolver,
    FundraiserProfileResolver,
    DeliveryStaffProfileResolver,
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

        // Infrastructure - gRPC Controller
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

        // Presentation - Resolvers
        UserQueryResolver,
        UserMutationResolver,
        UserAdminResolver,
        DonorProfileResolver,
        KitchenStaffProfileResolver,
        FundraiserProfileResolver,
        DeliveryStaffProfileResolver,
    ],
    exports: [UserRepository],
})
export class AppModule {}
