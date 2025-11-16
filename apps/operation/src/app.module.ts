import { Module } from "@nestjs/common"
import {
    DeliveryTaskMutationResolver,
    DeliveryTaskQueryResolver,
    DeliveryTaskStatsQueryResolver,
    ExpenseProofMutationResolver,
    ExpenseProofQueryResolver,
    InflowTransactionAdminResolver,
    InflowTransactionFundraiserResolver,
    InflowTransactionPublicResolver,
    IngredientRequestMutationResolver,
    IngredientRequestQueryResolver,
    MealBatchMutationResolver,
    MealBatchQueryResolver,
    OperationRequestMutationResolver,
    OperationRequestQueryResolver,
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
    UserClientService,
} from "./shared"
import { PrismaOperationService } from "./infrastructure"
import { PrismaClient } from "./generated/operation-client"
import { AwsCognitoModule } from "@libs/aws-cognito"
import { envConfig } from "@libs/env"
import { SentryModule, DatadogModule } from "@libs/observability"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { EnvModule } from "@libs/env/env.module"
import { HealthController } from "./presentation/http"
import { OperationGrpcController } from "./presentation/grpc"
import { GrpcModule } from "@libs/grpc"
import {
    DeliveryTaskService,
    ExpenseProofCacheService,
    ExpenseProofService,
    InflowTransactionService,
    InflowTransactionValidationService,
    IngredientRequestItemService,
    IngredientRequestService,
    MealBatchCacheService,
    OperationRequestCacheService,
    OperationRequestService,
} from "./application/services"
import { SpacesUploadService } from "@libs/s3-storage"
import {
    DeliveryStatusLogRepository,
    DeliveryTaskRepository,
    ExpenseProofRepository,
    InflowTransactionRepository,
    MealBatchRepository,
    OperationRequestRepository,
} from "./application/repositories"
import { MealBatchService } from "./application/services/meal-batch/meal-batch.service"
import { DeliveryTaskCacheService } from "./application/services/delivery-task"
import { IngredientRequestCacheService } from "./application/services/ingredient-request"

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
    controllers: [
        HealthController,
        OperationGrpcController,
    ],
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
        InflowTransactionRepository,
        MealBatchRepository,
        OperationRequestRepository,
        DeliveryTaskRepository,
        DeliveryStatusLogRepository,

        AuthorizationService,
        UserClientService,
        SpacesUploadService,

        IngredientRequestCacheService,
        IngredientRequestService,
        IngredientRequestItemService,
        ExpenseProofCacheService,
        ExpenseProofService,
        MealBatchCacheService,
        MealBatchService,
        OperationRequestCacheService,
        OperationRequestService,
        DeliveryTaskCacheService,
        DeliveryTaskService,
        InflowTransactionService,
        InflowTransactionValidationService,

        UserResolver,
        CampaignPhaseResolver,
        IngredientRequestMutationResolver,
        IngredientRequestQueryResolver,
        ExpenseProofMutationResolver,
        ExpenseProofQueryResolver,
        MealBatchMutationResolver,
        MealBatchQueryResolver,
        OperationRequestMutationResolver,
        OperationRequestQueryResolver,
        DeliveryTaskMutationResolver,
        DeliveryTaskQueryResolver,
        DeliveryTaskStatsQueryResolver,
        InflowTransactionAdminResolver,
        InflowTransactionFundraiserResolver,
        InflowTransactionPublicResolver,
    ],
})
export class AppModule {}
