import { UserRepository } from "../../repositories"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class FundraiserService {
    private readonly logger = new Logger(FundraiserService.name)

    constructor(private readonly UserRepository: UserRepository) {}
}
