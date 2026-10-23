import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"
import { createHash } from "node:crypto"

@Injectable()
export abstract class BaseCacheService<T> {
    protected abstract readonly TTL: Record<string, number>
    protected abstract readonly KEYS: Record<string, string>

    constructor(protected readonly redis: RedisService) {}

    // ==================== Single Entity ====================

    protected async getSingle(
        keyPrefix: string,
        id: string,
    ): Promise<T | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${keyPrefix}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as T
        }

        return null
    }

    protected async setSingle(
        keyPrefix: string,
        id: string,
        entity: T,
        ttl: number,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${keyPrefix}:${id}`
        await this.redis.set(key, JSON.stringify(entity), { ex: ttl })
    }

    protected async deleteSingle(keyPrefix: string, id: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${keyPrefix}:${id}`
        await this.redis.del(key)
    }

    // ==================== Entity Lists ====================

    protected generateListCacheKey(
        keyPrefix: string,
        params: Record<string, any>,
    ): string {
        const hash = createHash("sha256")
            .update(JSON.stringify(params))
            .digest("hex")
            .substring(0, 16)

        return `${keyPrefix}:${hash}`
    }

    protected async getList(
        keyPrefix: string,
        params: Record<string, any>,
    ): Promise<T[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = this.generateListCacheKey(keyPrefix, params)
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as T[]
        }

        return null
    }

    protected async setList(
        keyPrefix: string,
        params: Record<string, any>,
        entities: T[],
        ttl: number,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = this.generateListCacheKey(keyPrefix, params)
        await this.redis.set(key, JSON.stringify(entities), { ex: ttl })
    }

    protected async deleteAllLists(keyPrefix: string): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${keyPrefix}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Related Entity Lists ====================

    protected async getRelatedList(
        keyPrefix: string,
        relatedId: string,
        ...params: (string | number)[]
    ): Promise<T[] | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = [keyPrefix, relatedId, ...params].join(":")
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as T[]
        }

        return null
    }

    protected async setRelatedList(
        keyPrefix: string,
        relatedId: string,
        entities: T[],
        ttl: number,
        ...params: (string | number)[]
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = [keyPrefix, relatedId, ...params].join(":")
        await this.redis.set(key, JSON.stringify(entities), { ex: ttl })
    }

    protected async deleteRelatedList(
        keyPrefix: string,
        relatedId: string,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const pattern = `${keyPrefix}:${relatedId}:*`
        const keys = await this.redis.keys(pattern)

        if (keys.length > 0) {
            await this.redis.del(keys)
        }
    }

    // ==================== Statistics ====================

    protected async getStats<TStats>(
        keyPrefix: string,
        statsKey: string = "global",
    ): Promise<TStats | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${keyPrefix}:${statsKey}`
        const cached = await this.redis.get(key)

        if (cached) {
            return JSON.parse(cached) as TStats
        }

        return null
    }

    protected async setStats<TStats>(
        keyPrefix: string,
        stats: TStats,
        ttl: number,
        statsKey: string = "global",
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${keyPrefix}:${statsKey}`
        await this.redis.set(key, JSON.stringify(stats), { ex: ttl })
    }

    protected async deleteStats(
        keyPrefix: string,
        statsKey: string = "global",
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${keyPrefix}:${statsKey}`
        await this.redis.del(key)
    }

    // ==================== Counters ====================

    protected async getCounter(
        keyPrefix: string,
        id: string,
    ): Promise<number | null> {
        if (!this.redis.isAvailable()) {
            return null
        }

        const key = `${keyPrefix}:${id}`
        const cached = await this.redis.get(key)

        if (cached) {
            return Number.parseInt(cached, 10)
        }

        return null
    }

    protected async setCounter(
        keyPrefix: string,
        id: string,
        count: number,
        ttl: number,
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        const key = `${keyPrefix}:${id}`
        await this.redis.set(key, count.toString(), { ex: ttl })
    }

    protected async incrementCounter(
        keyPrefix: string,
        id: string,
        ttl: number,
    ): Promise<number> {
        if (!this.redis.isAvailable()) {
            return 0
        }

        const key = `${keyPrefix}:${id}`
        const newCount = await this.redis.incr(key)

        if (newCount === 1) {
            await this.redis.expire(key, ttl)
        }

        return newCount
    }

    protected async decrementCounter(
        keyPrefix: string,
        id: string,
        ttl: number,
    ): Promise<number> {
        if (!this.redis.isAvailable()) {
            return 0
        }

        const key = `${keyPrefix}:${id}`
        const newCount = await this.redis.decr(key)

        if (newCount < 0) {
            await this.redis.set(key, "0", { ex: ttl })
            return 0
        }

        return newCount
    }

    // ==================== Invalidation ====================

    protected async invalidateMultiple(
        ...operations: Promise<void>[]
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        await Promise.all(operations)
    }

    protected async invalidateByPatterns(
        ...patterns: string[]
    ): Promise<void> {
        if (!this.redis.isAvailable()) {
            return
        }

        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern)
            if (keys.length > 0) {
                await this.redis.del(keys)
            }
        }
    }

    // ==================== Health Check ====================

    async getHealthStatus(keyPattern: string): Promise<{
        available: boolean
        keysCount: number
    }> {
        const isAvailable = this.redis.isAvailable()

        if (!isAvailable) {
            return { available: false, keysCount: 0 }
        }

        const keys = await this.redis.keys(keyPattern)
        const keysCount = keys.length

        return { available: true, keysCount }
    }
}