import { Injectable, Logger } from "@nestjs/common"
import { DeliveryStaffRepository } from "../../repositories"

@Injectable()
export class DeliveryStaffService {
    private readonly logger = new Logger(DeliveryStaffService.name)

    constructor(private readonly deliveryStaffRepository: DeliveryStaffRepository) {}

    // Delivery Staff Business Logic: Get own profile only
    async getProfile(userId: string) {
        this.logger.log(`Getting delivery staff profile for user: ${userId}`)
        return this.deliveryStaffRepository.findDeliveryStaffProfile(userId)
    }

    // Delivery Staff Business Logic: Get own stats
    async getStats(userId: string) {
        this.logger.log(`Getting delivery staff stats for user: ${userId}`)
        return this.deliveryStaffRepository.getDeliveryStaffStats(userId)
    }

    // Public: Get top delivery staff (for leaderboard)
    async getTopDeliveryStaff(limit: number = 10) {
        this.logger.log(`Getting top ${limit} delivery staff`)
        return this.deliveryStaffRepository.getTopDeliveryStaff(limit)
    }

    // Public: Get available delivery staff
    async getAvailableStaff() {
        this.logger.log("Getting available delivery staff")
        return this.deliveryStaffRepository.getAvailableDeliveryStaff()
    }
}