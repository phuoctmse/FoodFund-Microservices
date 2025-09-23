import { Controller, Get } from "@nestjs/common"
import { AuthService } from "./auth.service"

@Controller("health")
export class HealthController {
    constructor(private readonly service: AuthService) {}

  @Get()
    getHealth() {
        return this.service.getHealth()
    }
}
