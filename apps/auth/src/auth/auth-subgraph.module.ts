import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "libs/aws-cognito"
import { HealthController } from "./health.controller"
import { AuthGrpcService } from "./grpc"
import { GrpcModule } from "libs/grpc"
import { AuthLibModule } from "libs/auth/auth.module"
import { AuthResolver } from "./resolvers/auth.resolver"
import { AuthService } from "./services/auth.service"
import { CognitoMapperHelper } from "./helpers/cognito-mapper.helper"

@Module({
    providers: [
        // Resolver
        AuthResolver,

        // Service
        AuthService,

        // Helpers
        CognitoMapperHelper,

        // gRPC
        AuthGrpcService,
    ],
    imports: [
        GrpcModule,
        AuthLibModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: true,
            mockMode: false, // Enable for development without AWS credentials
        }),
    ],
    controllers: [HealthController],
})
export class AuthSubgraphModule {}
