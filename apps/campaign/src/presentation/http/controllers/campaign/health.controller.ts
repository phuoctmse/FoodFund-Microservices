import { CampaignCacheService } from "@app/campaign/src/application/services/campaign/campaign-cache.service"
import { Controller, Get } from "@nestjs/common"

@Controller("health")
export class HealthController {
    constructor(private readonly cacheService: CampaignCacheService) {}

    @Get()
    async checkHealth() {
        try {
            const cacheHealth = await this.cacheService.getHealthStatus()

            return {
                status: "healthy",
                timestamp: new Date().toISOString(),
                services: {
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
