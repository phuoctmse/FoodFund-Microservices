import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../../generated/user-client"
import { CreateDonorProfileInput, UpdateDonorProfileInput } from "../../dto/user.types"

@Injectable()
export class DonorRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findDonorProfile(){

    }

    async updateDonorProfile(){}
}