export interface PrismaModuleOptions {
    datasourceUrl?: string
    isGlobal?: boolean
    enableLogging?: boolean
    logLevel?: ("query" | "info" | "warn" | "error")[]
}
