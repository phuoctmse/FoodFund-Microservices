import { Injectable } from "@nestjs/common"
import { PrismaService } from "libs/databases/prisma"
import { PrismaClient } from "../../generated/campaign-client"

@Injectable()
export class PrismaCampaignService extends PrismaService<PrismaClient> {
    protected readonly client: PrismaClient

    constructor() {
        super()
        this.client = new PrismaClient({
            log: [
                { emit: "event", level: "query" },
                { emit: "event", level: "error" },
                { emit: "event", level: "warn" },
            ],
        })
    }
}
