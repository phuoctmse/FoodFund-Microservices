import { Injectable, Logger } from "@nestjs/common"
import { SystemConfigRepository } from "../../repositories/system-config.repository"
import { SystemConfig } from "../../../domain/entities/system-config.model"

@Injectable()
export class SystemConfigService {
    private readonly logger = new Logger(SystemConfigService.name)

    constructor(
        private readonly systemConfigRepository: SystemConfigRepository,
    ) { }

    /**
     * Get config value by key
     */
    async getConfigValue(key: string): Promise<string | null> {
        const config = await this.systemConfigRepository.findByKey(key)
        return config?.value ?? null
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
            this.logger.log(`Config ${key} deleted`)
            return true
        } catch {
            return false
        }
    }
}
