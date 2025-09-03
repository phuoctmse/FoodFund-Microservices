import { PrismaClient } from "@prisma/client"
import { DatabaseName, PrismaModuleOptions } from "./prisma.types"
import { PrismaClientOptions } from "@prisma/client/runtime/library"

export class PrismaConnectionFactory {
    private static connections = new Map<string, PrismaClient>()

    static async createConnection(
        options: PrismaModuleOptions,
    ): Promise<PrismaClient> {
        const {
            database = DatabaseName.Main,
            enableLogging = true,
            logLevel = ["query", "info", "warn", "error"],
            datasourceUrl,
            databaseConfig,
            clientOptions = {} as PrismaClientOptions,
        } = options

        const connectionKey = `prisma_${database}`

        // Check if connection already exists
        if (this.connections.has(connectionKey)) {
            return this.connections.get(connectionKey)!
        }

        // Get database URL
        let dbUrl = datasourceUrl || process.env.DATABASE_URL

        if (databaseConfig && databaseConfig[database]) {
            dbUrl = databaseConfig[database].url
        }
        // Create Prisma client with options
        const prismaClient = new PrismaClient({
            log: enableLogging ? logLevel : [],
            datasourceUrl: dbUrl,
        })

        // Add connection lifecycle hooks
        await this.setupConnectionHooks(prismaClient, connectionKey)

        // Store connection
        this.connections.set(connectionKey, prismaClient)

        return prismaClient
    }

    private static async setupConnectionHooks(
        client: PrismaClient,
        connectionKey: string,
    ) {
    // Connect to database
        await client.$connect()

        // Setup disconnect hook
        process.on("beforeExit", async () => {
            await client.$disconnect()
            this.connections.delete(connectionKey)
        })

        // Log successful connection
        console.log(`🚀 Prisma connection established: ${connectionKey}`)
    }

    static async getConnection(
        database: DatabaseName = DatabaseName.Main,
    ): Promise<PrismaClient> {
        const connectionKey = `prisma_${database}`
        return this.connections.get(connectionKey)!
    }

    static async closeConnection(
        database: DatabaseName = DatabaseName.Main,
    ): Promise<void> {
        const connectionKey = `prisma_${database}`
        const connection = this.connections.get(connectionKey)

        if (connection) {
            await connection.$disconnect()
            this.connections.delete(connectionKey)
            console.log(`💀 Prisma connection closed: ${connectionKey}`)
        }
    }

    static async closeAllConnections(): Promise<void> {
        const promises = Array.from(this.connections.entries()).map(
            async ([key, connection]) => {
                await connection.$disconnect()
                console.log(`💀 Prisma connection closed: ${key}`)
            },
        )

        await Promise.all(promises)
        this.connections.clear()
    }
}
