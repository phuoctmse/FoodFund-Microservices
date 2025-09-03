import { DynamicModule, Module, Type } from "@nestjs/common"
import {
    ConfigurableModuleClass,
    OPTIONS_TYPE,
} from "./prisma.module-definition"
import { DatabaseName } from "./prisma.types"
import { getPrismaConnectionName, getPrismaToken } from "./utils"
import { PrismaConnectionFactory } from "./connection.factory"
import { PrismaClient } from "@prisma/client"
import { BaseRepository } from "./schemas/repositories/base.repository"

@Module({})
export class PrismaModule extends ConfigurableModuleClass {
    public static forRoot(options: typeof OPTIONS_TYPE = {}): DynamicModule {
        const dynamicModule = super.forRoot(options)

        options.database = options.database || DatabaseName.Main
        const connectionName = getPrismaConnectionName(options)

        const {
            isGlobal = true,
            enableLogging = true,
            logLevel = ["query", "info", "warn", "error"],
        } = options

        const moduleDefinition: DynamicModule = {
            ...dynamicModule,
            providers: [
                {
                    provide: connectionName,
                    useFactory: async () => {
                        return await PrismaConnectionFactory.createConnection(options)
                    },
                },
                {
                    provide: "PRISMA_OPTIONS",
                    useValue: {
                        enableLogging,
                        logLevel,
                        database: options.database,
                        clientOptions: options.clientOptions,
                    },
                },
            ],
            exports: [connectionName, "PRISMA_OPTIONS"],
        }

        if (isGlobal) {
            return {
                ...moduleDefinition,
                global: true,
            }
        }

        return moduleDefinition
    }

    public static forFeature(
        repositories: Type<BaseRepository>[] = [],
        options: typeof OPTIONS_TYPE = {},
    ): DynamicModule {
        const connectionName = getPrismaConnectionName(options)

        const providers = repositories.map((repository) => ({
            provide: repository,
            useFactory: (prismaClient: PrismaClient) => {
                return new repository(prismaClient)
            },
            inject: [connectionName],
        }))

        return {
            module: PrismaModule,
            providers,
            exports: repositories,
        }
    }

    public static forFeatureAsync(repositoryFactories: any[]): DynamicModule {
        return {
            module: PrismaModule,
            providers: repositoryFactories,
            exports: repositoryFactories.map((factory) => factory.provide),
        }
    }
}
