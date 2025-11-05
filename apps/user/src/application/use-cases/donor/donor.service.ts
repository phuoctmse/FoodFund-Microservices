import { DonorErrorHelper } from "@app/user/src/domain/exceptions"
import { UserRepository } from "@app/user/src/domain/repositories"
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

    // // Donor Business Logic: Get donation stats
    // async getDonationStats(userId: string) {
    //     this.logger.log(`Getting donation stats for user: ${userId}`)
    //     return this.donorRepository.getDonorStats(userId)
    // }

    // // Public: Get top donors (for leaderboard)
    // async getTopDonors(limit: number = 10) {
    //     this.logger.log(`Getting top ${limit} donors`)
    //     return this.donorRepository.getTopDonors(limit)
    // }
}
