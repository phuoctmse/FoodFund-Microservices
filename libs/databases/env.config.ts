import { DatabaseName, DatabaseConfig } from './prisma/prisma.types';

export interface EnvironmentConfig {
  databases: {
    prisma: Record<DatabaseName, DatabaseConfig>;
  };
}

export function envConfig(): EnvironmentConfig {
  return {
    databases: {
      prisma: {
        [DatabaseName.Main]: {
          url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/foodfund_main',
          name: 'main',
          schema: 'public'
        },
        [DatabaseName.Analytics]: {
          url: process.env.ANALYTICS_DATABASE_URL || 'postgresql://username:password@localhost:5432/foodfund_analytics',
          name: 'analytics',
          schema: 'public'
        },
        [DatabaseName.Logging]: {
          url: process.env.LOGGING_DATABASE_URL || 'postgresql://username:password@localhost:5432/foodfund_logging',
          name: 'logging',
          schema: 'public'
        }
      }
    }
  };
}
