import {
    Injectable,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from "@nestjs/common"

export interface IPrismaClient {
    $connect(): Promise<void>
    $disconnect(): Promise<void>
}

@Injectable()
export abstract class PrismaService<T extends IPrismaClient = any>
implements OnModuleInit, OnModuleDestroy
{
    protected readonly logger = new Logger(this.constructor.name)
    protected abstract readonly client: T

    async onModuleInit() {
        try {
            await this.client.$connect()
            this.logger.log("🚀 Prisma Client connected to database")
        } catch (error) {
            this.logger.error("Failed to connect to database", error)
            throw error
        }
    }

    async onModuleDestroy() {
        try {
            await this.client.$disconnect()
            this.logger.log("👋 Prisma Client disconnected from database")
        } catch (error) {
            this.logger.error("Error disconnecting from database", error)
        }
    }
}
