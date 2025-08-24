import { DynamicModule, Module } from '@nestjs/common';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './prisma.module-definition';
import { DatabaseName } from './prisma.types';
import { getPrismaConnectionName, getPrismaToken } from './utils';
import { PrismaConnectionFactory } from './connection.factory';
import { PrismaClient } from '@prisma/client';
import {
  UserRepository,
  CampaignRepository,
  DonationRepository,
  CommentRepository,
} from './models';

@Module({})
export class PrismaModule extends ConfigurableModuleClass {
    public static forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const dynamicModule = super.forRoot(options);

        options.database = options.database || DatabaseName.Main;
        const connectionName = getPrismaConnectionName(options);

        const {
            isGlobal = true,
            enableLogging = true,
            logLevel = ['query', 'info', 'warn', 'error']
        } = options;

        const moduleDefinition: DynamicModule = {
            ...dynamicModule,
            imports: [
                this.forFeature(options)
            ],
            providers: [
                {
                    provide: connectionName,
                    useFactory: async () => {
                        return await PrismaConnectionFactory.createConnection(options);
                    }
                },
                {
                    provide: 'PRISMA_OPTIONS',
                    useValue: { 
                        enableLogging, 
                        logLevel,
                        database: options.database,
                        clientOptions: options.clientOptions
                    }
                }
            ],
            exports: [connectionName, 'PRISMA_OPTIONS'],
        };

        if (isGlobal) {
            return {
                ...moduleDefinition,
                global: true,
            };
        }

        return moduleDefinition;
    }

    private static forFeature(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const connectionName = getPrismaConnectionName(options);
        
        return {
            module: PrismaModule,
            providers: [
                {
                    provide: UserRepository,
                    useFactory: (prismaClient: PrismaClient) => {
                        return new UserRepository(prismaClient);
                    },
                    inject: [connectionName]
                },
                {
                    provide: CampaignRepository,
                    useFactory: (prismaClient: PrismaClient) => {
                        return new CampaignRepository(prismaClient);
                    },
                    inject: [connectionName]
                },
                {
                    provide: DonationRepository,
                    useFactory: (prismaClient: PrismaClient) => {
                        return new DonationRepository(prismaClient);
                    },
                    inject: [connectionName]
                },
                {
                    provide: CommentRepository,
                    useFactory: (prismaClient: PrismaClient) => {
                        return new CommentRepository(prismaClient);
                    },
                    inject: [connectionName]
                }
            ],
            exports: [
                UserRepository,
                CampaignRepository,
                DonationRepository,
                CommentRepository
            ]
        };
    }

    public static forFeatureAsync(repositoryFactories: any[]): DynamicModule {
        return {
            module: PrismaModule,
            providers: repositoryFactories,
            exports: repositoryFactories.map(factory => factory.provide)
        };
    }
}
