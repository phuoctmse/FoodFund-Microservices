import { DeliveryStaffRepository } from "@app/user/src/domain/repositories"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class DeliveryStaffService {
    private readonly logger = new Logger(DeliveryStaffService.name)

    constructor(
        private readonly deliveryStaffRepository: DeliveryStaffRepository,
    ) {}
}
