import { DonorErrorHelper } from "@app/user/src/domain/exceptions"
import { UserRepository } from "../../repositories"
import { Role } from "@libs/databases"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class DonorService {
    private readonly logger = new Logger(DonorService.name)

    constructor(private readonly userRepository: UserRepository) {}

    async getProfile(cognitoId: string) {
        this.logger.log(`Getting donor profile for user: ${cognitoId}`)

        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            DonorErrorHelper.throwDonorProfileIncomplete(["User not found"])
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwDonorOnlyOperation("get profile")
        }

        return user
    }
}
