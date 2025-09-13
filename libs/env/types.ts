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
}

// Configuration interfaces
export interface ContainerConfig {
  host: string;
  port?: number;
  healthCheckPort: number;
}

export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  secret: string;
  accessTokenExpiration: string;
  refreshTokenExpiration: string;
}

export interface AwsCognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
  clientSecret: string;
}

export interface AwsConfig {
  region: string;
  cognito: AwsCognitoConfig;
  accessKeyId: string;
  secretAccessKey: string;
}

// Main environment configuration interface
export interface EnvironmentConfig {
  nodeEnv: NodeEnv;

  // Container configurations
  containers: {
    [key in Container]?: ContainerConfig;
  };

  // Database configurations
  databases: {
    // main: DatabaseConfig;
    users: DatabaseConfig;
    campaigns: DatabaseConfig;
  };

  // Authentication & Security
  jwt: JwtConfig;

  // AWS Configuration
  aws: AwsConfig;
}

export interface EnvModuleOptions {
  isGlobal?: boolean;
}