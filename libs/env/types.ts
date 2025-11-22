// Enums
export enum NodeEnv {
    Development = "development",
    Production = "production",
    Test = "test",
}

export enum Container {
    Auth = "auth",
    GraphQLGateway = "graphql-gateway",
    UsersSubgraph = "users-subgraph",
    CampaignsSubgraph = "campaigns-subgraph",
    OperationSubgraph = "operation-subgraph",
}

export enum GrpcService {
    Auth = "auth",
    User = "user",
    Campaign = "campaign",
    Donation = "donation",
    Operation = "operation",
}

// Configuration interfaces
export interface ContainerConfig {
    host: string
    port?: number
    healthCheckPort: number
}

export interface GrpcServiceConfig {
    port: number
    url: string
}

export interface DatabaseConfig {
    url: string
}

export interface JwtConfig {
    secret: string
    accessTokenExpiration: string
    refreshTokenExpiration: string
}

export interface AwsCognitoConfig {
    region: string
    userPoolId: string
    clientId: string
    clientSecret: string
}

export interface AwsConfig {
    region: string
    cognito: AwsCognitoConfig
    accessKeyId: string
    secretAccessKey: string
    awsOpenSearchEndpoint: string
    awsSqsQueueUrl: string
}

export interface RedisConfig {
    host: string
    port: number
    password: string
    username: string
}

export interface BrevoConfig {
    apiKey: string
    senderEmail: string
    senderName: string
}

export interface PayOSConfig {
    payosClienId: string
    payosApiKey: string
    payosCheckSumKey: string
    payosBankNumber: string
    payosBankName: string
    payosBankAccountName: string
    payosBankFullName: string
    payosBankLogo: string
}

export interface DataDogConfig {
    agentHost: string
    agentPort: number
    traceAgentPort: number
    env: string
    version: string
    logsInjection: boolean
    traceEnabled: boolean
    site: string
    traceSampleRate: number
}

export interface Badge {
    firstDonationId: string
    bronzeId: string
    silverId: string
    goldId: string
    platinumId: string
    diamondId: string 
}

// Main environment configuration interface
export interface EnvironmentConfig {
    nodeEnv: NodeEnv

    systemAdminId: string

    cors_origin: string

    // Container configurations
    containers: {
        [key in Container]?: ContainerConfig
    }

    // gRPC configurations
    grpc: {
        [key in GrpcService]?: GrpcServiceConfig
    }

    // Database configurations
    databases: {
        // main: DatabaseConfig;
        users: DatabaseConfig
        campaigns: DatabaseConfig
        operations: DatabaseConfig
    }

    // Authentication & Security
    jwt: JwtConfig

    // AWS Configuration
    aws: AwsConfig

    // Sentry Configuration
    sentry: {
        dsn: string
        environment: string
        release: string
    }

    // Redis Configuration
    redis: RedisConfig

    // Google Configuration
    google: GoogleConfig

    //Payos Configuration
    payos: PayOSConfig

    //DataDog Configuration
    datadog: DataDogConfig

    //Brevo Configuration
    brevo: BrevoConfig

    badge: Badge

    frontEndUrl: string
}

export interface EnvModuleOptions {
    isGlobal?: boolean
}

export interface GoogleConfig {
    clientId: string
}
