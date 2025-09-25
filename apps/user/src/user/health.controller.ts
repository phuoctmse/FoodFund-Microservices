import { Controller, Get } from "@nestjs/common"
import { UserService } from "./user.service"

@Controller("health")
export class HealthController {
    constructor(private readonly service: UserService) {}

    @Get()
    getHealth() {
        return this.service.getHealth()
    }
}
