import {
    Inject,
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import Redis, { type RedisOptions } from "ioredis"
import { DEFAULT_REDIS_PORT, LOCALHOST } from "@libs/env"
import { MODULE_OPTIONS_TOKEN } from "./redis.module-definition"
import type {
    RedisModuleOptions,
    RedisConnectionInfo,
    RedisHealthStatus,
    RedisSetOptions,
    RedisGetOptions,
} from "./redis.types"

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name)
    private client: Redis | null = null
    private isConnected = false
    private connectionStartTime = 0

    constructor(
        @Inject(MODULE_OPTIONS_TOKEN)
        private readonly options: RedisModuleOptions,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.connect()
    }

    async onModuleDestroy(): Promise<void> {
        await this.disconnect()
    }

    /**
     * Connect to Redis server
     */
    private async connect(): Promise<void> {
        try {
            const redisOptions = this.buildRedisOptions()
            this.connectionStartTime = Date.now()

            this.client = new Redis(redisOptions)

            // Set up event listeners
            this.client.on("connect", () => {
                this.logger.log(
                    `Connected to Redis at ${redisOptions.host}:${redisOptions.port}`,
                )
                this.isConnected = true
            })

            this.client.on("ready", () => {
                this.logger.log("Redis client is ready")
            })

            this.client.on("error", (error) => {
                this.logger.error("Redis connection error", error)
                this.isConnected = false
            })

            this.client.on("close", () => {
                this.logger.warn("Redis connection closed")
                this.isConnected = false
            })

            this.client.on("reconnecting", (time) => {
                this.logger.log(`Redis reconnecting in ${time}ms`)
            })

            // Test connection
            await this.client.ping()
            this.logger.log("Redis connection established successfully")
        } catch (error) {
            this.logger.error("Failed to connect to Redis", error)
            this.client = null
            this.isConnected = false
        }
    }

    /**
     * Disconnect from Redis server
     */
    private async disconnect(): Promise<void> {
        if (this.client) {
            try {
                await this.client.quit()
                this.logger.log("Redis connection closed gracefully")
            } catch (error) {
                this.logger.error("Error closing Redis connection", error)
            }
            this.client = null
            this.isConnected = false
        }
    }

    /**
     * Build Redis connection options from resolved module options
     * No need to re-resolve config - already done in module
     */
    private buildRedisOptions(): RedisOptions {
        const redisOptions: RedisOptions = {
            host: this.options.host || LOCALHOST,
            port: this.options.port || DEFAULT_REDIS_PORT,
            db: this.options.db || 0,
            keyPrefix: this.options.keyPrefix,
            maxRetriesPerRequest: this.options.maxRetriesPerRequest || 3,
            connectTimeout: this.options.connectTimeout || 10000,
            commandTimeout: this.options.commandTimeout || 5000,
            enableReadyCheck: this.options.enableReadyCheck ?? true,
            lazyConnect: this.options.lazyConnect ?? false,
            family: this.options.family || 4,
            keepAlive: this.options.keepAlive || 30000,
        }

        if (this.options.password) {
            redisOptions.password = this.options.password
        }

        if (this.options.username) {
            redisOptions.username = this.options.username
        }

        // Add TLS support if configured
        if (this.options.tls) {
            redisOptions.tls = this.options.tls
        }

        return redisOptions
    }

    /**
     * Get Redis client instance
     */
    getClient(): Redis {
        if (!this.client) {
            throw new Error("Redis client is not connected")
        }
        return this.client
    }

    /**
     * Check if Redis is available
     */
    isAvailable(): boolean {
        return this.isConnected && this.client !== null
    }

    /**
     * Get connection info
     */
    getConnectionInfo(): RedisConnectionInfo {
        const options = this.buildRedisOptions()
        return {
            host: options.host!,
            port: options.port!,
            db: options.db!,
            status: this.isConnected ? "connected" : "disconnected",
            uptime: this.isConnected
                ? Date.now() - this.connectionStartTime
                : undefined,
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<RedisHealthStatus> {
        try {
            if (!this.isAvailable()) {
                return {
                    status: "unhealthy",
                    details: {
                        connection: this.getConnectionInfo(),
                        lastCheck: new Date(),
                    },
                }
            }

            // Ping Redis
            const pingResult = await this.client!.ping()
            if (pingResult !== "PONG") {
                return {
                    status: "degraded",
                    details: {
                        connection: this.getConnectionInfo(),
                        lastCheck: new Date(),
                    },
                }
            }

            // Get memory info if available
            let memoryUsage: number | undefined
            try {
                const info = await this.client!.memory("USAGE", "temp-key")
                memoryUsage = typeof info === "number" ? info : undefined
            } catch {
                // Memory usage info not available
            }

            return {
                status: "healthy",
                details: {
                    connection: this.getConnectionInfo(),
                    memoryUsage,
                    lastCheck: new Date(),
                },
            }
        } catch (error) {
            this.logger.error("Redis health check failed", error)
            return {
                status: "unhealthy",
                details: {
                    connection: this.getConnectionInfo(),
                    lastCheck: new Date(),
                },
            }
        }
    }

    // === STRING OPERATIONS ===

    /**
     * Set a key-value pair
     */
    async set(
        key: string,
        value: string | number,
        options?: RedisSetOptions,
    ): Promise<"OK" | null> {
        if (!this.isAvailable()) {
            this.logger.warn("Redis not available, skipping SET operation")
            return null
        }

        try {
            if (options?.ex) {
                return await this.client!.set(key, value, "EX", options.ex)
            }
            if (options?.px) {
                return await this.client!.set(key, value, "PX", options.px)
            }
            if (options?.nx) {
                return await this.client!.set(key, value, "NX")
            }
            if (options?.xx) {
                return await this.client!.set(key, value, "XX")
            }

            return await this.client!.set(key, value)
        } catch (error) {
            this.logger.error(`Redis SET error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get a value by key
     */
    async get(key: string, options?: RedisGetOptions): Promise<string | null> {
        if (!this.isAvailable()) {
            this.logger.warn(
                "Redis not available, returning null for GET operation",
            )
            return null
        }

        try {
            return await this.client!.get(key)
        } catch (error) {
            this.logger.error(`Redis GET error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Delete a key
     */
    async del(key: string | string[]): Promise<number> {
        if (!this.isAvailable()) {
            this.logger.warn("Redis not available, skipping DEL operation")
            return 0
        }

        try {
            if (Array.isArray(key)) {
                return await this.client!.del(...key)
            }
            return await this.client!.del(key)
        } catch (error) {
            this.logger.error("Redis DEL error for key(s)", error)
            throw error
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        if (!this.isAvailable()) {
            return false
        }

        try {
            const result = await this.client!.exists(key)
            return result === 1
        } catch (error) {
            this.logger.error(`Redis EXISTS error for key ${key}`, error)
            return false
        }
    }

    /**
     * Set expiration for a key
     */
    async expire(key: string, seconds: number): Promise<boolean> {
        if (!this.isAvailable()) {
            return false
        }

        try {
            const result = await this.client!.expire(key, seconds)
            return result === 1
        } catch (error) {
            this.logger.error(`Redis EXPIRE error for key ${key}`, error)
            return false
        }
    }

    /**
     * Get TTL for a key
     */
    async ttl(key: string): Promise<number> {
        if (!this.isAvailable()) {
            return -1
        }

        try {
            return await this.client!.ttl(key)
        } catch (error) {
            this.logger.error(`Redis TTL error for key ${key}`, error)
            return -1
        }
    }

    // === HASH OPERATIONS ===

    /**
     * Set hash field
     */
    async hset(
        key: string,
        field: string,
        value: string | number,
    ): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.hset(key, field, value)
        } catch (error) {
            this.logger.error(`Redis HSET error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get hash field
     */
    async hget(key: string, field: string): Promise<string | null> {
        if (!this.isAvailable()) {
            return null
        }

        try {
            return await this.client!.hget(key, field)
        } catch (error) {
            this.logger.error(`Redis HGET error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get all hash fields and values
     */
    async hgetall(key: string): Promise<Record<string, string>> {
        if (!this.isAvailable()) {
            return {}
        }

        try {
            return await this.client!.hgetall(key)
        } catch (error) {
            this.logger.error(`Redis HGETALL error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Delete hash field
     */
    async hdel(key: string, field: string | string[]): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            if (Array.isArray(field)) {
                return await this.client!.hdel(key, ...field)
            }
            return await this.client!.hdel(key, field)
        } catch (error) {
            this.logger.error(`Redis HDEL error for key ${key}`, error)
            throw error
        }
    }

    // === LIST OPERATIONS ===

    /**
     * Push to left of list
     */
    async lpush(
        key: string,
        ...values: (string | number | Buffer)[]
    ): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.lpush(key, ...values)
        } catch (error) {
            this.logger.error(`Redis LPUSH error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Push to right of list
     */
    async rpush(
        key: string,
        ...values: (string | number | Buffer)[]
    ): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.rpush(key, ...values)
        } catch (error) {
            this.logger.error(`Redis RPUSH error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Pop from left of list
     */
    async lpop(key: string): Promise<string | null> {
        if (!this.isAvailable()) {
            return null
        }

        try {
            return await this.client!.lpop(key)
        } catch (error) {
            this.logger.error(`Redis LPOP error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Pop from right of list
     */
    async rpop(key: string): Promise<string | null> {
        if (!this.isAvailable()) {
            return null
        }

        try {
            return await this.client!.rpop(key)
        } catch (error) {
            this.logger.error(`Redis RPOP error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get list range
     */
    async lrange(key: string, start = 0, stop = -1): Promise<string[]> {
        if (!this.isAvailable()) {
            return []
        }

        try {
            return await this.client!.lrange(key, start, stop)
        } catch (error) {
            this.logger.error(`Redis LRANGE error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get list length
     */
    async llen(key: string): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.llen(key)
        } catch (error) {
            this.logger.error(`Redis LLEN error for key ${key}`, error)
            return 0
        }
    }

    // === SET OPERATIONS ===

    /**
     * Add members to set
     */
    async sadd(
        key: string,
        ...members: (string | number | Buffer)[]
    ): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.sadd(key, ...members)
        } catch (error) {
            this.logger.error(`Redis SADD error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Remove members from set
     */
    async srem(
        key: string,
        ...members: (string | number | Buffer)[]
    ): Promise<number> {
        if (!this.isAvailable()) {
            return 0
        }

        try {
            return await this.client!.srem(key, ...members)
        } catch (error) {
            this.logger.error(`Redis SREM error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Get all set members
     */
    async smembers(key: string): Promise<string[]> {
        if (!this.isAvailable()) {
            return []
        }

        try {
            return await this.client!.smembers(key)
        } catch (error) {
            this.logger.error(`Redis SMEMBERS error for key ${key}`, error)
            throw error
        }
    }

    /**
     * Check if member exists in set
     */
    async sismember(
        key: string,
        member: string | number | Buffer,
    ): Promise<boolean> {
        if (!this.isAvailable()) {
            return false
        }

        try {
            const result = await this.client!.sismember(key, member)
            return result === 1
        } catch (error) {
            this.logger.error(`Redis SISMEMBER error for key ${key}`, error)
            return false
        }
    }

    // === UTILITY METHODS ===

    /**
     * Get keys matching pattern
     */
    async keys(pattern = "*"): Promise<string[]> {
        if (!this.isAvailable()) {
            return []
        }

        try {
            return await this.client!.keys(pattern)
        } catch (error) {
            this.logger.error(`Redis KEYS error for pattern ${pattern}`, error)
            return []
        }
    }

    /**
     * Flush all data from current database
     */
    async flushdb(): Promise<"OK"> {
        if (!this.isAvailable()) {
            throw new Error("Redis not available")
        }

        try {
            return await this.client!.flushdb()
        } catch (error) {
            this.logger.error("Redis FLUSHDB error", error)
            throw error
        }
    }

    /**
     * Execute a Redis command directly
     */
    async executeCommand(
        command: string,
        ...args: (string | number | Buffer)[]
    ): Promise<any> {
        if (!this.isAvailable()) {
            throw new Error("Redis not available")
        }

        try {
            return await this.client!.call(command, ...args)
        } catch (error) {
            this.logger.error(`Redis command ${command} error`, error)
            throw error
        }
    }

    /**
     * Execute multiple commands in a pipeline
     */
    async pipeline(
        commands: Array<[string, ...(string | number | Buffer)[]]>,
    ): Promise<any[]> {
        if (!this.isAvailable()) {
            throw new Error("Redis not available")
        }

        try {
            const pipeline = this.client!.pipeline()

            for (const [command, ...args] of commands) {
                pipeline.call(command, ...args)
            }

            const results = await pipeline.exec()
            return (
                results?.map(([error, result]) => {
                    if (error) throw error
                    return result
                }) || []
            )
        } catch (error) {
            this.logger.error("Redis pipeline error", error)
            throw error
        }
    }
}
