import { Controller, Get } from "@nestjs/common"

/**
 * Presentation Controller: Health
 * HTTP health check endpoint
 */
@Controller("health")
export class HealthController {
    @Get()
    getHealth() {
        return {
            status: "healthy",
            service: "auth",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }
    }
}
