export interface RedisModuleOptions {
    host?: string
    port?: number
    password?: string
    username?: string
    db?: number
    keyPrefix?: string
    maxRetriesPerRequest?: number
    connectTimeout?: number
    commandTimeout?: number
    enableReadyCheck?: boolean
    lazyConnect?: boolean
    family?: 4 | 6
    keepAlive?: number
    // TLS options
    tls?: {
        cert?: string
        key?: string
        ca?: string
        rejectUnauthorized?: boolean
    }
    // Cluster options
    cluster?: {
        enableOfflineQueue?: boolean
        redisOptions?: Partial<RedisModuleOptions>
        maxRedirections?: number
        retryDelayOnFailover?: number
    }
}

export interface RedisConnectionInfo {
    host: string
    port: number
    db: number
    status: "connected" | "connecting" | "disconnected" | "error"
    uptime?: number
    lastError?: string
}

export interface RedisSetOptions {
    ex?: number // Expire time in seconds
    px?: number // Expire time in milliseconds
    nx?: boolean // Only set if key doesn't exist
    xx?: boolean // Only set if key exists
}

export interface RedisGetOptions {
    decode?: boolean // Whether to decode the value
}

export interface RedisListOptions {
    start?: number
    stop?: number
}

export interface RedisHashOptions {
    fields?: string[]
}

export interface RedisHealthStatus {
    status: "healthy" | "unhealthy" | "degraded"
    details: {
        connection: RedisConnectionInfo
        memoryUsage?: number
        commandsProcessed?: number
        lastCheck: Date
    }
}