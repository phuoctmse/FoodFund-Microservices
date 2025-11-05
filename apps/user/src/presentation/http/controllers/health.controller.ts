import { Controller, Get } from "@nestjs/common"

@Controller("health")
export class HealthController {
    @Get()
    getHealth() {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }
    }
}
