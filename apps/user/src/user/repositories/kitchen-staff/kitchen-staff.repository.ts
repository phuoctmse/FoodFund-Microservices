import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateKitchenStaffProfileInput, UpdateKitchenStaffProfileInput } from "../../dto/user.types"

@Injectable()
export class KitchenStaffRepository {
    constructor(private readonly prisma: PrismaClient) {}

}