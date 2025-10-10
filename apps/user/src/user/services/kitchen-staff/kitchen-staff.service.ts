import { Injectable, Logger } from "@nestjs/common"
import { KitchenStaffRepository } from "../../repositories"

@Injectable()
export class KitchenStaffService {
    private readonly logger = new Logger(KitchenStaffService.name)

    constructor(private readonly kitchenStaffRepository: KitchenStaffRepository) {}

}