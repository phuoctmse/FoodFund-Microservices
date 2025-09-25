import { Injectable } from "@nestjs/common"
import { UserRepository, CreateStaffUserInput } from "../user.repository"
import { Role } from "libs/databases/prisma/schemas"

@Injectable()
export class ProfileService {
    constructor(private readonly userRepository: UserRepository) {}

    async createProfileForUser(
        userId: string,
        role: Role,
        cognitoAttributes?: Record<string, string>,
    ) {
        switch (role) {
        case Role.DONOR:
            await this.userRepository.createDonorProfile(userId)
            break
        case Role.KITCHEN_STAFF:
            await this.userRepository.createKitchenStaffProfile(userId)
            break
        case Role.FUNDRAISER:
            await this.userRepository.createFundraiserProfile(
                userId,
                cognitoAttributes?.organization_address,
            )
            break
        case Role.DELIVERY_STAFF:
            await this.userRepository.createDeliveryStaffProfile(userId)
            break
        default:
            // Admin doesn't need a specific profile
            break
        }
    }

    async createStaffProfileForUser(
        userId: string,
        role: Role,
        staffData: CreateStaffUserInput,
    ) {
        switch (role) {
        case Role.KITCHEN_STAFF:
            await this.userRepository.createKitchenStaffProfile(userId)
            break
        case Role.FUNDRAISER:
            await this.userRepository.createFundraiserProfile(
                userId,
                staffData.organization_address,
            )
            break
        case Role.DELIVERY_STAFF:
            await this.userRepository.createDeliveryStaffProfile(userId)
            break
        default:
            // Admin and other roles don't need specific profiles for staff creation
            break
        }
    }
}
