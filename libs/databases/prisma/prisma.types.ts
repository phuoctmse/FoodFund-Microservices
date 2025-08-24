import { PrismaClient } from '@prisma/client';

export enum DatabaseName {
  Main = 'main',
  Analytics = 'analytics',
  Logging = 'logging'
}

export interface DatabaseConfig {
  url: string;
  name?: string;
  schema?: string;
}

export interface PrismaModuleOptions {
  database?: DatabaseName;
  isGlobal?: boolean;
  enableLogging?: boolean;
  logLevel?: ('query' | 'info' | 'warn' | 'error')[];
  datasourceUrl?: string;
  databaseConfig?: Record<DatabaseName, DatabaseConfig>;
  clientOptions?: ConstructorParameters<typeof PrismaClient>[0];
}

export interface PrismaFeatureOptions {
  database?: DatabaseName;
}