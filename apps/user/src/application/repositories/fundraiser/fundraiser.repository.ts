import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"

@Injectable()
export class FundraiserRepository {
    constructor(private readonly prisma: PrismaClient) {}
}
