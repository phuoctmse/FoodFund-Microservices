import { Module } from "@nestjs/common"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "libs/aws-cognito"
import { HealthController } from "./health.controller"
import { AuthGrpcService } from "./grpc"
import { GrpcModule } from "libs/grpc"
import { AuthLibModule } from "libs/auth/auth.module"
import { 
    AdminResolver,
    AuthRegistrationResolver,
    AuthAuthenticationResolver,
    AuthUserResolver
} from "./resolvers"
import { AuthService } from "./auth.service"
import { AuthResolver } from "./auth.resolver"
import { 
    AdminService,
    AuthRegistrationService,
    AuthAuthenticationService,
    AuthUserService,
    AuthAdminService
} from "./services"

@Module({
    providers: [
        // Resolvers
        AdminResolver,
        AuthRegistrationResolver,
        AuthAuthenticationResolver,
        AuthUserResolver,
        
        // Main resolver (facade)
        AuthResolver,
        
        // Main services
        AuthService,
        AdminService,
        
        // Sub-services
        AuthRegistrationService,
        AuthAuthenticationService,
        AuthUserService,
        AuthAdminService,
        
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
