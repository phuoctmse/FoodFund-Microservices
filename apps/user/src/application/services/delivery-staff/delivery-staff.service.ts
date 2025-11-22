import { UserRepository } from "../../repositories"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class DeliveryStaffService {
    private readonly logger = new Logger(DeliveryStaffService.name)

    constructor(
        private readonly UserRepository: UserRepository,
    ) {}
}
