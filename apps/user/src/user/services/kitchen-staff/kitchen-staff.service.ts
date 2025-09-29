import { Injectable, Logger } from "@nestjs/common"
import { KitchenStaffRepository } from "../../repositories"

@Injectable()
export class KitchenStaffService {
    private readonly logger = new Logger(KitchenStaffService.name)

    constructor(private readonly kitchenStaffRepository: KitchenStaffRepository) {}

    // Kitchen Staff Business Logic: Get own profile only
    async getProfile(userId: string) {
        this.logger.log(`Getting kitchen staff profile for user: ${userId}`)
        return this.kitchenStaffRepository.findKitchenStaffProfile(userId)
    }

    // Kitchen Staff Business Logic: Get own stats
    async getStats(userId: string) {
        this.logger.log(`Getting kitchen staff stats for user: ${userId}`)
        return this.kitchenStaffRepository.getKitchenStaffStats(userId)
    }

    // Public: Get top cooks (for leaderboard)
    async getTopCooks(limit: number = 10) {
        this.logger.log(`Getting top ${limit} kitchen staff`)
        return this.kitchenStaffRepository.getTopCooks(limit)
    }
}