// cSpell:words payos PAYOS sepay SEPAY
import { EnvironmentConfig, NodeEnv, Container, GrpcService } from "./types"
import {
    DEFAULT_HEALTH_PORT,
    LOCALHOST,
    DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION,
    DEFAULT_JWT_ACCESS_TOKEN_EXPIRATION,
} from "./env.constants"

export const envConfig = (): EnvironmentConfig => ({
    nodeEnv: (process.env.NODE_ENV ?? NodeEnv.Development) as NodeEnv,

    systemAdminId: process.env.SYSTEM_ADMIN_ID as string,

    cors_origin: process.env.CORS_ORIGIN ?? "",

    // Container configurations
    containers: {
        [Container.Auth]: {
            host: process.env.AUTH_HOST ?? LOCALHOST,
            port: process.env.AUTH_PORT
                ? Number.parseInt(process.env.AUTH_PORT)
                : 8002,
            healthCheckPort: process.env.AUTH_HEALTH_CHECK_PORT
                ? Number.parseInt(process.env.AUTH_HEALTH_CHECK_PORT)
                : DEFAULT_HEALTH_PORT,
        },
        [Container.GraphQLGateway]: {
            host: process.env.GRAPHQL_GATEWAY_HOST ?? LOCALHOST,
            port: process.env.GRAPHQL_GATEWAY_PORT
                ? Number.parseInt(process.env.GRAPHQL_GATEWAY_PORT)
                : 8001,
            healthCheckPort: process.env.GRAPHQL_GATEWAY_HEALTH_CHECK_PORT
                ? Number.parseInt(process.env.GRAPHQL_GATEWAY_HEALTH_CHECK_PORT)
                : DEFAULT_HEALTH_PORT + 1,
        },
        [Container.UsersSubgraph]: {
            host: process.env.USERS_SUBGRAPH_HOST ?? LOCALHOST,
            port: process.env.USERS_SUBGRAPH_PORT
                ? Number.parseInt(process.env.USERS_SUBGRAPH_PORT)
                : 8003,
            healthCheckPort: process.env.USERS_SUBGRAPH_HEALTH_CHECK_PORT
                ? Number.parseInt(process.env.USERS_SUBGRAPH_HEALTH_CHECK_PORT)
                : DEFAULT_HEALTH_PORT + 2,
        },
        [Container.CampaignsSubgraph]: {
            host: process.env.CAMPAIGNS_SUBGRAPH_HOST ?? LOCALHOST,
            port: process.env.CAMPAIGNS_SUBGRAPH_PORT
                ? Number.parseInt(process.env.CAMPAIGNS_SUBGRAPH_PORT)
                : 8004,
            healthCheckPort: process.env.CAMPAIGNS_SUBGRAPH_HEALTH_CHECK_PORT
                ? Number.parseInt(
                    process.env.CAMPAIGNS_SUBGRAPH_HEALTH_CHECK_PORT,
                )
                : DEFAULT_HEALTH_PORT + 3,
        },
        [Container.OperationSubgraph]: {
            host: process.env.OPERATION_SUBGRAPH_HOST ?? LOCALHOST,
            port: process.env.OPERATION_SUBGRAPH_PORT
                ? Number.parseInt(process.env.OPERATION_SUBGRAPH_PORT)
                : 8005,
            healthCheckPort: process.env.OPERATION_SUBGRAPH_HEALTH_CHECK_PORT
                ? Number.parseInt(
                    process.env.OPERATION_SUBGRAPH_HEALTH_CHECK_PORT,
                )
                : DEFAULT_HEALTH_PORT + 4,
        },
    },

    // Database configurations
    databases: {
        // main: {
        //     url: process.env.DATABASE_URL as string,
        // },
        users: {
            url: process.env.USERS_DATABASE_URL as string,
        },
        campaigns: {
            url: process.env.CAMPAIGN_DATABASE_URL as string,
        },
        operations: {
            url: process.env.OPERATIONS_DATABASE_URL as string,
        },
    },

    // Authentication & Security
    jwt: {
        secret: process.env.JWT_SECRET ?? "dev-jwt-secret",
        accessTokenExpiration:
            process.env.JWT_ACCESS_TOKEN_EXPIRATION ??
            DEFAULT_JWT_ACCESS_TOKEN_EXPIRATION,
        refreshTokenExpiration:
            process.env.JWT_REFRESH_TOKEN_EXPIRATION ??
            DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION,
    },

    // gRPC configurations
    grpc: {
        [GrpcService.Auth]: {
            port: process.env.AUTH_GRPC_PORT
                ? Number.parseInt(process.env.AUTH_GRPC_PORT)
                : 50001,
            url: process.env.AUTH_GRPC_URL ?? "localhost:50001",
        },
        [GrpcService.User]: {
            port: process.env.USER_GRPC_PORT
                ? Number.parseInt(process.env.USER_GRPC_PORT)
                : 50002,
            url: process.env.USER_GRPC_URL ?? "localhost:50002",
        },
        [GrpcService.Campaign]: {
            port: process.env.CAMPAIGN_GRPC_PORT
                ? Number.parseInt(process.env.CAMPAIGN_GRPC_PORT)
                : 50003,
            url: process.env.CAMPAIGN_GRPC_URL ?? "localhost:50003",
        },
        [GrpcService.Operation]: {
            port: process.env.OPERATION_GRPC_PORT
                ? Number.parseInt(process.env.OPERATION_GRPC_PORT)
                : 50004,
            url: process.env.OPERATION_GRPC_URL ?? "localhost:50004",
        },
    },

    // AWS Configuration
    aws: {
        region: process.env.AWS_REGION as string,
        cognito: {
            region: process.env.AWS_REGION as string,
            userPoolId: process.env.AWS_COGNITO_USER_POOL_ID as string,
            clientId: process.env.AWS_COGNITO_CLIENT_ID as string,
            clientSecret: process.env.AWS_COGNITO_CLIENT_SECRET as string,
        },
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        awsOpenSearchEndpoint: process.env.AWS_OPENSEARCH_ENDPOINT as string,
        awsSqsQueueUrl: process.env.AWS_SQS_QUEUE_URL as string,
    },

    // Sentry Configuration
    sentry: {
        dsn: process.env.SENTRY_DSN ?? "",
        environment: process.env.SENTRY_ENVIRONMENT ?? "development",
        release: process.env.SENTRY_RELEASE ?? "1.0.0",
    },

    google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
    },

    redis: {
        host: process.env.REDIS_HOST as string,
        port: Number.parseInt(process.env.REDIS_PORT as string),
        password: process.env.REDIS_PASSWORD as string,
        username: process.env.REDIS_USERNAME as string,
    },

    payos: {
        payosApiKey: process.env.PAYOS_API_KEY as string,
        payosCheckSumKey: process.env.PAYOS_CHECKSUM_KEY as string,
        payosClienId: process.env.PAYOS_CLIENT_ID as string,
        payosBankName: process.env.PAYOS_BANK_NAME as string,
        payosBankNumber: process.env.PAYOS_BANK_NUMBER as string,
        payosBankAccountName: process.env.PAYOS_BANK_ACCOUNT_NAME as string,
        payosBankFullName: process.env.PAYOS_BANK_FULLNAME as string,
        payosBankLogo: process.env.PAYOS_BANK_LOGO as string,
    },

    datadog: {
        agentHost: process.env.DD_AGENT_HOST || "localhost",
        traceAgentPort: Number.parseInt(
            process.env.DD_TRACE_AGENT_PORT || "8126",
        ),
        agentPort: Number.parseInt(process.env.DD_AGENT_PORT || "8125"),
        env: process.env.DD_ENV || process.env.NODE_ENV || "development",
        version: process.env.DD_VERSION || "1.0.0",
        logsInjection: (process.env.DD_LOGS_INJECTION ?? "true") === "true",
        traceEnabled: (process.env.DD_TRACE_ENABLED ?? "true") === "true",
        site: process.env.DD_SITE || "us5.datadoghq.com",
        traceSampleRate: Number.parseFloat(
            process.env.DD_TRACE_SAMPLE_RATE || "1.0",
        ),
    },

    brevo: {
        apiKey: process.env.BREVO_API_KEY as string,
        senderEmail: process.env.BREVO_SENDER_EMAIL as string,
        senderName: process.env.BREVO_SENDER_NAME as string,
    }
})

// Utility functions
export function isDevelopment(): boolean {
    return (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === NodeEnv.Development
    )
}

export function isProduction(): boolean {
    return (
        process.env.NODE_ENV === "production" ||
        process.env.NODE_ENV === NodeEnv.Production
    )
}

export function isTest(): boolean {
    return (
        process.env.NODE_ENV === "test" || process.env.NODE_ENV === NodeEnv.Test
    )
}
