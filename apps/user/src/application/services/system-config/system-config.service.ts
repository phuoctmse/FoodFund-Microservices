import { Injectable, Logger } from "@nestjs/common"
import { SystemConfigRepository } from "../../repositories/system-config.repository"
import { SystemConfig } from "../../../domain/entities/system-config.model"

interface CacheEntry {
    value: string
    expiresAt: number
}

@Injectable()
export class SystemConfigService {
    private readonly logger = new Logger(SystemConfigService.name)
    private readonly cache = new Map<string, CacheEntry>()
    private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

    constructor(
        private readonly systemConfigRepository: SystemConfigRepository,
    ) { }

    /**
     * Get config value by key with caching
     */
    async getConfigValue(key: string): Promise<string | null> {
        // Check cache first
        const cached = this.cache.get(key)
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value
        }

        // Fetch from DB
        const config = await this.systemConfigRepository.findByKey(key)
        if (!config) {
            return null
        }

        // Update cache
        this.cache.set(key, {
            value: config.value,
            expiresAt: Date.now() + this.CACHE_TTL_MS,
        })

        return config.value
    }

    /**
     * Get config value as number with default fallback
     */
    async getConfigNumber(key: string, defaultValue: number): Promise<number> {
        try {
            const value = await this.getConfigValue(key)
            if (value === null) {
                this.logger.warn(
                    `Config ${key} not found, using default: ${defaultValue}`,
                )
                return defaultValue
            }

            const parsed = Number(value)
            if (isNaN(parsed)) {
                this.logger.warn(
                    `Config ${key} is not a valid number: ${value}, using default: ${defaultValue}`,
                )
                return defaultValue
            }

            return parsed
        } catch (error) {
            this.logger.error(
                `Failed to get config ${key}, using default: ${defaultValue}`,
                error,
            )
            return defaultValue
        }
    }

    /**
     * Get all configs
     */
    async getAllConfigs(): Promise<SystemConfig[]> {
        const configs = await this.systemConfigRepository.findAll()
        return configs.map((config) => ({
            key: config.key,
            value: config.value,
            description: config.description ?? undefined,
            dataType: config.data_type,
            updatedAt: config.updated_at,
        }))
    }

    /**
     * Get single config by key
     */
    async getConfig(key: string): Promise<SystemConfig | null> {
        const config = await this.systemConfigRepository.findByKey(key)
        if (!config) {
            return null
        }

        return {
            key: config.key,
            value: config.value,
            description: config.description ?? undefined,
            dataType: config.data_type,
            updatedAt: config.updated_at,
        }
    }

    /**
     * Update or create config
     */
    async updateConfig(data: {
        key: string
        value: string
        description?: string
        dataType?: string
    }): Promise<SystemConfig> {
        const config = await this.systemConfigRepository.upsert(data)

        // Invalidate cache
        this.cache.delete(data.key)

        this.logger.log(`Config ${data.key} updated to: ${data.value}`)

        return {
            key: config.key,
            value: config.value,
            description: config.description ?? undefined,
            dataType: config.data_type,
            updatedAt: config.updated_at,
        }
    }

    /**
     * Delete config
     */
    async deleteConfig(key: string): Promise<boolean> {
        try {
            await this.systemConfigRepository.delete(key)
            this.cache.delete(key)
            this.logger.log(`Config ${key} deleted`)
            return true
        } catch {
            return false
        }
    }

    /**
     * Clear cache (for testing or manual refresh)
     */
    clearCache(): void {
        this.cache.clear()
        this.logger.log("Config cache cleared")
    }
}
