import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateDeliveryStaffProfileInput, UpdateDeliveryStaffProfileInput } from "../../dto/user.types"

@Injectable()
export class DeliveryStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}

    
}