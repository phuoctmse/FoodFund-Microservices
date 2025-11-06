import { Module } from "@nestjs/common"
import {
    IngredientRequestMutationResolver,
    IngredientRequestQueryResolver,
} from "./presentation"
import {
    IngredientRequestItemRepository,
    IngredientRequestItemService,
    IngredientRequestRepository,
    IngredientRequestService,
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
import { SentryModule } from "@libs/observability"
import { GraphQLSubgraphModule } from "@libs/graphql/subgraph"
import { EnvModule } from "@libs/env/env.module"
import { HealthController } from "./presentation/http"
import { GrpcModule } from "@libs/grpc"

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

        AuthorizationService,
        IngredientRequestService,
        IngredientRequestItemService,

        UserResolver,
        CampaignPhaseResolver,
        IngredientRequestMutationResolver,
        IngredientRequestQueryResolver,
    ],
})
export class AppModule {}
