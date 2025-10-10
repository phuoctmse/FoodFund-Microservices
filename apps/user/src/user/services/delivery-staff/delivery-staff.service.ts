import { Injectable, Logger } from "@nestjs/common"
import { DeliveryStaffRepository } from "../../repositories"

@Injectable()
export class DeliveryStaffService {
    private readonly logger = new Logger(DeliveryStaffService.name)

    constructor(private readonly deliveryStaffRepository: DeliveryStaffRepository) {}

}