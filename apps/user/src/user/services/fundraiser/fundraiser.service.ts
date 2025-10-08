import { Injectable, Logger } from "@nestjs/common"
import { FundraiserRepository } from "../../repositories"
import { UpdateFundraiserProfileInput } from "../../dto/profile.input"

@Injectable()
export class FundraiserService {
    private readonly logger = new Logger(FundraiserService.name)

    constructor(private readonly fundraiserRepository: FundraiserRepository) {}

}