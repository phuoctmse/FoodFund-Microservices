import { Controller, Get } from "@nestjs/common"
import { CampaignCacheService, CampaignService } from "../services"

@Controller("health")
export class HealthController {
    constructor(
        private readonly campaignService: CampaignService,
        private readonly cacheService: CampaignCacheService,
    ) {}

    @Get()
    async checkHealth() {
        try {
            const dbHealth = await this.campaignService.checkDatabaseHealth()
            const cacheHealth = await this.cacheService.getHealthStatus()

            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
                services: {
                    database: {
                        status: dbHealth.status,
                        timestamp: dbHealth.timestamp,
                    },
                    cache: {
                        available: cacheHealth.available,
                        keysCount: cacheHealth.keysCount,
                    },
                    application: {
                        uptime: process.uptime(),
                        version: "1.0.0",
                    },
                },
            }
        } catch (error) {
            return {
                status: "unhealthy",
                timestamp: new Date().toISOString(),
                error: error.message,
            }
        }
    }

    @Get("db")
    async checkDatabaseHealth() {
        return await this.campaignService.checkDatabaseHealth()
    }

    @Get("cache")
    async checkCacheHealth() {
        const health = await this.cacheService.getHealthStatus()
        return {
            status: health.available ? "healthy" : "unavailable",
            available: health.available,
            keysCount: health.keysCount,
            timestamp: new Date().toISOString(),
        }
    }
}
