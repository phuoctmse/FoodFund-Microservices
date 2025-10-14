import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"

@Injectable()
export class KitchenStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}
}
