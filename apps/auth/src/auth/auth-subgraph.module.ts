import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "libs/aws-cognito"
import { HealthController } from "./health.controller"
import { AuthGrpcService } from "./grpc"
import { GrpcModule } from "libs/grpc"
import { AuthLibModule } from "libs/auth/auth.module"
import {
    AuthRegistrationResolver,
    AuthAuthenticationResolver,
    AuthUserResolver,
} from "./resolvers"
import {
    AuthRegistrationService,
    AuthAuthenticationService,
    AuthUserService,
} from "./services"

@Module({
    providers: [
        // Resolvers
        AuthRegistrationResolver,
        AuthAuthenticationResolver,
        AuthUserResolver,

        // Services
        AuthRegistrationService,
        AuthAuthenticationService,
        AuthUserService,

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
