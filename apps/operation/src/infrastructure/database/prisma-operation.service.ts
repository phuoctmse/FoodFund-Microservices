import { PrismaService } from "@libs/databases"
import { PrismaClient } from "../../generated/operation-client"
import { Injectable } from "@nestjs/common"

@Injectable()
export class PrismaOperationService extends PrismaService<PrismaClient> {
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
