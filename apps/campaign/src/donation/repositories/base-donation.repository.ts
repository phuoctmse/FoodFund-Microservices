import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/campaign-client"

/**
 * Base repository with shared database access
 */
@Injectable()
export class BaseDonationRepository {
    constructor(protected readonly prisma: PrismaClient) {}
}
