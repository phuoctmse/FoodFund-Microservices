import { DatabaseName, PrismaFeatureOptions } from "./prisma.types"

export function getPrismaConnectionName(
    options: PrismaFeatureOptions = {},
): string {
    return `prisma_${options.database || DatabaseName.Main}`
}

export function getPrismaToken(options: PrismaFeatureOptions = {}): string {
    const connectionName = getPrismaConnectionName(options)
    return `${connectionName}_token`
}

export function getPrismaServiceToken(
    options: PrismaFeatureOptions = {},
): string {
    const connectionName = getPrismaConnectionName(options)
    return `${connectionName}_service`
}
