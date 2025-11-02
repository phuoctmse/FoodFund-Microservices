import { Module } from "@nestjs/common"
import { envConfig } from "libs/env"
import { SentryModule } from "libs/observability/sentry.module"
import { EnvModule } from "@libs/env/env.module"
import { GraphQLSubgraphModule } from "libs/graphql/subgraph"
import { AwsCognitoModule } from "libs/aws-cognito"
import { GrpcModule } from "libs/grpc"
import { AuthLibModule } from "libs/auth/auth.module"

// ============================================
// PRESENTATION LAYER
// ============================================
// GraphQL
import { AuthResolver } from "./presentation/graphql/resolvers"

// gRPC
import { AuthGrpcController } from "./presentation/grpc/controllers"

// HTTP
import { HealthController } from "./presentation/http/controllers"

// ============================================
// APPLICATION LAYER
// ============================================
import { AuthApplicationService } from "./application/services/auth-application.service"

// ============================================
// INFRASTRUCTURE LAYER
// ============================================
import { CognitoAdapter } from "./infrastructure/external/aws"
import { UserGrpcClient } from "./infrastructure/messaging/grpc"

// ============================================
// SHARED LAYER
// ============================================
import { UserMapper } from "./shared/mappers"

/**
 * App Module - Clean Architecture (4 Layers)
 *
 * Architecture:
 * 1. Presentation Layer - GraphQL Resolvers, gRPC Controllers, HTTP Controllers
 * 2. Application Layer - Business Logic Services
 * 3. Domain Layer - Entities & Interfaces (no imports needed, used via DI)
 * 4. Infrastructure Layer - External Services (AWS Cognito, gRPC Clients)
 *
 * Dependency Flow:
 * Presentation → Application → Domain ← Infrastructure
 */
@Module({
    imports: [
        // ============================================
        // CORE MODULES
        // ============================================
        EnvModule.forRoot(),
        SentryModule.forRoot({
            dsn: envConfig().sentry.dsn,
            serviceName: "auth-service",
            environment: envConfig().sentry.environment,
            release: envConfig().sentry.release,
            enableTracing: true,
        }),

        // ============================================
        // EXTERNAL MODULES
        // ============================================
        GrpcModule,
        AuthLibModule,
        GraphQLSubgraphModule.forRoot({
            debug: true,
            playground: true,
        }),
        AwsCognitoModule.forRoot({
            isGlobal: true,
            mockMode: false, // Set to true for development without AWS
        }),
    ],

    controllers: [
        // ============================================
        // PRESENTATION LAYER - HTTP CONTROLLERS
        // ============================================
        HealthController,
    ],

    providers: [
        // ============================================
        // PRESENTATION LAYER - RESOLVERS & gRPC
        // ============================================
        AuthResolver,
        AuthGrpcController,

        // ============================================
        // APPLICATION LAYER - BUSINESS LOGIC
        // ============================================
        AuthApplicationService,

        // ============================================
        // INFRASTRUCTURE LAYER - ADAPTERS
        // ============================================
        // Auth Provider (AWS Cognito)
        {
            provide: "IAuthProvider",
            useClass: CognitoAdapter,
        },
        CognitoAdapter,

        // User Service (gRPC Client)
        {
            provide: "IUserService",
            useClass: UserGrpcClient,
        },
        UserGrpcClient,

        // ============================================
        // SHARED LAYER - UTILITIES
        // ============================================
        UserMapper,
    ],
})
export class AppModule {}
