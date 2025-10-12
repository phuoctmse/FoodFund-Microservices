import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"

@Injectable()
export class DeliveryStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}

    
}