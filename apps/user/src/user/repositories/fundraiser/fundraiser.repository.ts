import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateFundraiserProfileInput, UpdateFundraiserProfileInput } from "../../dto/user.types"

@Injectable()
export class FundraiserRepository {
    constructor(private readonly prisma: PrismaClient) {}

}