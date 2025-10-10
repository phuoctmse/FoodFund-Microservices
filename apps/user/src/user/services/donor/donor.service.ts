import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { UserRepository } from "../../repositories/user.repository"
import { UpdateUserInput } from "../../dto/user.input"
import { Role } from "libs/databases/prisma/schemas"
import { DonorErrorHelper } from "../../exceptions"

@Injectable()
export class DonorService {
    private readonly logger = new Logger(DonorService.name)

    constructor(private readonly userRepository: UserRepository) {}

    async updateProfile(cognitoId: string, updateData: UpdateUserInput) {
        this.logger.log(`Donor updating profile: ${cognitoId}`)
        
        // Validate user exists and is a donor
        const user = await this.userRepository.findUserById(cognitoId)
        if (!user) {
            DonorErrorHelper.throwDonorProfileIncomplete(["User not found"])
        }

        if (user.role !== Role.DONOR) {
            DonorErrorHelper.throwDonorOnlyOperation("update profile")
        }

        // Update user profile directly since we no longer have separate donor_profile table
        const updatedUser = await this.userRepository.updateUser(user.id, updateData)

        return updatedUser
    }

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