import { Injectable, Logger } from "@nestjs/common"
import { FundraiserRepository } from "../../repositories"
import { UpdateFundraiserProfileInput } from "../../dto/profile.input"

@Injectable()
export class FundraiserService {
    private readonly logger = new Logger(FundraiserService.name)

    constructor(private readonly fundraiserRepository: FundraiserRepository) {}

    // Fundraiser Business Logic: Update profile info (like donor)
    async updateProfile(profileId: string, updateData: UpdateFundraiserProfileInput) {
        this.logger.log(`Fundraiser updating profile: ${profileId}`)
        return this.fundraiserRepository.updateFundraiserProfile(profileId, updateData)
    }

    // Fundraiser Business Logic: Get own profile
    async getProfile(userId: string) {
        this.logger.log(`Getting fundraiser profile for user: ${userId}`)
        return this.fundraiserRepository.findFundraiserProfile(userId)
    }

    // Fundraiser Business Logic: Get own stats
    async getStats(userId: string) {
        this.logger.log(`Getting fundraiser stats for user: ${userId}`)
        return this.fundraiserRepository.getFundraiserStats(userId)
    }

    // Public: Get top fundraisers (for leaderboard)
    async getTopFundraisers(limit: number = 10) {
        this.logger.log(`Getting top ${limit} fundraisers`)
        return this.fundraiserRepository.getTopFundraisers(limit)
    }

    // Public: Get verified fundraisers
    async getVerifiedFundraisers() {
        this.logger.log("Getting verified fundraisers")
        return this.fundraiserRepository.getVerifiedFundraisers()
    }
}