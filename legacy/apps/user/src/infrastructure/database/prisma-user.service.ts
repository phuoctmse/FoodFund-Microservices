import { PrismaService } from "@libs/databases"
import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"

@Injectable()
export class PrismaUserService extends PrismaService<PrismaClient> {
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
