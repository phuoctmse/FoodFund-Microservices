// Simple types for Prisma module
export interface PrismaModuleOptions {
    datasourceUrl?: string
    isGlobal?: boolean
    enableLogging?: boolean
    logLevel?: ("query" | "info" | "warn" | "error")[]
}
