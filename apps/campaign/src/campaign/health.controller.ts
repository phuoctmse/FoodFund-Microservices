import { Controller, Get } from "@nestjs/common"
import { CampaignService } from "./campaign.service"

@Controller("health")
export class HealthController {
    constructor(private readonly campaignService: CampaignService) {}

    @Get()
    getHealth() {
        try {
            const health = this.campaignService.getHealth()
            return {
                status: "healthy",
                service: "campaign-service",
                timestamp: new Date().toISOString(),
                details: health,
            }
        } catch (error) {
            return {
                status: "unhealthy",
                service: "campaign-service",
                timestamp: new Date().toISOString(),
                error: "Service health check failed",
            }
        }
    }

    @Get("db")
    async getDatabaseHealth() {
        try {
            const dbHealth = await this.campaignService.checkDatabaseHealth()
            return {
                status: "healthy",
                database: "connected",
                details: dbHealth,
                timestamp: new Date().toISOString(),
            }
        } catch (error) {
            return {
                status: "unhealthy",
                database: "disconnected",
                error: "Database connection failed",
                timestamp: new Date().toISOString(),
            }
        }
    }
}
