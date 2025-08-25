import { EnvironmentConfig } from './types';

export function parseEnvConfig(): EnvironmentConfig {
  return {
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/foodfund',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    corsOrigin: process.env.CORS_ORIGIN,
  };
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
