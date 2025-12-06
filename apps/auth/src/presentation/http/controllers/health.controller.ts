import { Controller, Get } from "@nestjs/common"

@Controller("health")
export class HealthController {
    @Get()
    getHealth() {
        return {
            status: "healthy",
            service: "auth",
            timestamp: new Date().toISOString(),
        }
    }
}
