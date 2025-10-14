import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"

@Injectable()
export class DonorRepository {
    constructor(private readonly prisma: PrismaClient) {}
}
