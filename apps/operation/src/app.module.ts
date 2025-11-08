import { Module } from "@nestjs/common"
import {
    ExpenseProofMutationResolver,
    ExpenseProofQueryResolver,
    IngredientRequestMutationResolver,
    IngredientRequestQueryResolver,
} from "./presentation"
import {
    IngredientRequestItemRepository,
    IngredientRequestRepository,
} from "./application"
import {
    AuthorizationService,
    CampaignPhase,
    CampaignPhaseResolver,
    User,
    UserResolver,
} from "./shared"
import { PrismaOperationService } from "./infrastructure"
import { PrismaClient } from "./generated/operation-client"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { envConfig } from "@libs/env"
import { SentryModule, DatadogModule } from "@libs/observability"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { EnvModule } from "@libs/env/env.module"
import { HealthController } from "./presentation/http"
import { GrpcModule } from "@libs/grpc"
import {
    ExpenseProofService,
    IngredientRequestItemService,
    IngredientRequestService,
} from "./application/services"
import { SpacesUploadService } from "@libs/s3-storage"
import { ExpenseProofRepository } from "./application/repositories"

@Module({
    imports: [
        EnvModule.forRoot(),
        GraphQLSubgraphModule.forRoot({
            debug: process.env.NODE_ENV === "development",
            playground: process.env.NODE_ENV === "development",
            federationVersion: 2,
            path: "/graphql",
            buildSchemaOptions: {
                orphanedTypes: [User, CampaignPhase],
            },
        }),
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "operation-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),
        DatadogModule.forRoot({
            serviceName: "operation-service",
            env: envConfig().nodeEnv,
            version: process.env.SERVICE_VERSION || "1.0.0",
        }),
        AwsCognitoModule.forRoot({
            isGlobal: false,
            mockMode: false,
        }),
        GrpcModule,
    ],
    controllers: [HealthController],
    providers: [
        PrismaOperationService,
        {
            provide: PrismaClient,
            useFactory: (service: PrismaOperationService) => service["client"],
            inject: [PrismaOperationService],
        },

        IngredientRequestRepository,
        IngredientRequestItemRepository,
        ExpenseProofRepository,

        AuthorizationService,
        SpacesUploadService,
        IngredientRequestService,
        IngredientRequestItemService,
        ExpenseProofService,

        UserResolver,
        CampaignPhaseResolver,
        IngredientRequestMutationResolver,
        IngredientRequestQueryResolver,
        ExpenseProofMutationResolver,
        ExpenseProofQueryResolver,
    ],
})
export class AppModule {}
