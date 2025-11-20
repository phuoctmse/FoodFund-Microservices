import { UserRepository } from "../../repositories"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class KitchenStaffService {
    private readonly logger = new Logger(KitchenStaffService.name)

    constructor(
        private readonly UserRepository: UserRepository,
    ) {}
}
