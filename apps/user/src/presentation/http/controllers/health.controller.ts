import { Controller, Get } from "@nestjs/common"

/**
 * HTTP Controller: Health Check
 * Provides health check endpoint
 */
@Controller("health")
export class HealthController {
    @Get()
    check() {
        return {
            status: "ok",
            service: "user-service",
            timestamp: new Date().toISOString(),
        }
    }
}
