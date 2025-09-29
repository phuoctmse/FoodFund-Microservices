import { Injectable, Logger } from "@nestjs/common"
import { DonorRepository } from "../../repositories"
import { UpdateDonorProfileInput } from "../../dto/profile.input"

@Injectable()
export class DonorService {
    private readonly logger = new Logger(DonorService.name)

    constructor(private readonly donorRepository: DonorRepository) {}

    // Donor Business Logic: Update profile info
    async updateProfile(profileId: string, updateData: UpdateDonorProfileInput) {
        this.logger.log(`Donor updating profile: ${profileId}`)
        
        // Convert bigint to number if needed for total_donated
        const convertedUpdateData = {
            ...updateData,
            total_donated: updateData.total_donated !== undefined 
                ? Number(updateData.total_donated) 
                : undefined
        }
        
        return this.donorRepository.updateDonorProfile(profileId, convertedUpdateData as any)
    }

    // Donor Business Logic: Get own profile  
    async getProfile(userId: string) {
        this.logger.log(`Getting donor profile for user: ${userId}`)
        return this.donorRepository.findDonorProfile(userId)
    }

    // Donor Business Logic: Get donation stats
    async getDonationStats(userId: string) {
        this.logger.log(`Getting donation stats for user: ${userId}`)
        return this.donorRepository.getDonorStats(userId)
    }

    // Public: Get top donors (for leaderboard)
    async getTopDonors(limit: number = 10) {
        this.logger.log(`Getting top ${limit} donors`)
        return this.donorRepository.getTopDonors(limit)
    }
}