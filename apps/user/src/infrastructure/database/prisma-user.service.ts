import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"

/**
 * Infrastructure Service: Prisma User Database
 * Manages database connection lifecycle for User service
 */
@Injectable()
export class PrismaUserService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    async onModuleInit() {
        await this.$connect()
    }

    async onModuleDestroy() {
        await this.$disconnect()
    }
}
