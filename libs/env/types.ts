export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin?: string;
}

export interface EnvModuleOptions {
  isGlobal?: boolean;
}
