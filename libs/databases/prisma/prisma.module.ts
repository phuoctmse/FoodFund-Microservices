import { DynamicModule, Module, Global } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"

export interface PrismaModuleOptions {
    datasourceUrl?: string
    isGlobal?: boolean
    enableLogging?: boolean
    logLevel?: ("query" | "info" | "warn" | "error")[]
}

@Global()
@Module({})
export class PrismaModule {
    static forRoot(options: PrismaModuleOptions = {}): DynamicModule {
        const {
            datasourceUrl,
            isGlobal = true,
            enableLogging = true,
            logLevel = ["query", "info", "warn", "error"],
        } = options

        const prismaProvider = {
            provide: PrismaClient,
            useFactory: async (): Promise<PrismaClient> => {
                const prisma = new PrismaClient({
                    datasourceUrl,
                    log: enableLogging ? logLevel : [],
                })

                await prisma.$connect()
                console.log("🚀 Prisma connected to database")

                return prisma
            },
        }

        return {
            module: PrismaModule,
            global: isGlobal,
            providers: [prismaProvider],
            exports: [PrismaClient],
        }
    }

    static async onApplicationShutdown(): Promise<void> {
        // This will be handled by NestJS lifecycle if needed
    }
}
