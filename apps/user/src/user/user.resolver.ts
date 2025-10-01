import { Injectable } from "@nestjs/common"
import { UserService } from "./user.service"
import { UpdateUserInput } from "./dto/user.input"
import { Role } from "libs/databases/prisma/schemas"
import { UserHealthResponse } from "./types/health-response.model"
import {
    CreateUserInput as RepoCreateUserInput,
    CreateStaffUserInput,
    UpdateDonorProfileInput,
    UpdateKitchenStaffProfileInput,
    UpdateFundraiserProfileInput,
    UpdateDeliveryStaffProfileInput,
} from "./user.repository"

/**
 * UserResolver - Tổng hợp tất cả các user operations
 * Đây là facade pattern để cung cấp interface thống nhất cho tất cả user operations
 * Các GraphQL resolvers riêng biệt sẽ sử dụng class này thay vì gọi trực tiếp services
 */
@Injectable()
export class UserResolver {
    constructor(private readonly userService: UserService) {}

    // Health
    getHealth(): UserHealthResponse {
        return this.userService.getHealth()
    }

    // Query operations

    async findAllUsers(skip?: number, take?: number) {
        return this.userService.findAllUsers(skip, take)
    }

    async findUserById(id: string) {
        return this.userService.findUserById(id)
    }

    async findUserByEmail(email: string) {
        return this.userService.findUserByEmail(email)
    }

    async findUserByUsername(user_name: string) {
        return this.userService.findUserByUsername(user_name)
    }

    async findUserByCognitoId(cognito_id: string) {
        return this.userService.findUserByCognitoId(cognito_id)
    }

    async searchUsers(searchTerm: string, role?: Role) {
        return this.userService.searchUsers(searchTerm, role)
    }

    async getUsersByRole(role: Role) {
        return this.userService.getUsersByRole(role)
    }

    async getActiveUsers() {
        return this.userService.getActiveUsers()
    }

    async createStaffUser(createStaffUserInput: CreateStaffUserInput) {
        return this.userService.createStaffUser(createStaffUserInput)
    }

    async updateUser(id: string, updateUserInput: UpdateUserInput) {
        return this.userService.updateUser(id, updateUserInput)
    }

    async deleteUser(id: string) {
        return this.userService.deleteUser(id)
    }

    async softDeleteUser(id: string) {
        return this.userService.softDeleteUser(id)
    }

    // Profile operations
    async updateDonorProfile(
        id: string,
        updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        return this.userService.updateDonorProfile(id, updateDonorProfileInput)
    }

    async deleteDonorProfile(id: string) {
        return this.userService.deleteDonorProfile(id)
    }

    async updateKitchenStaffProfile(
        id: string,
        updateKitchenStaffProfileInput: UpdateKitchenStaffProfileInput,
    ) {
        return this.userService.updateKitchenStaffProfile(
            id,
            updateKitchenStaffProfileInput,
        )
    }

    async deleteKitchenStaffProfile(id: string) {
        return this.userService.deleteKitchenStaffProfile(id)
    }

    async updateFundraiserProfile(
        id: string,
        updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    ) {
        return this.userService.updateFundraiserProfile(
            id,
            updateFundraiserProfileInput,
        )
    }

    async deleteFundraiserProfile(id: string) {
        return this.userService.deleteFundraiserProfile(id)
    }

    async updateDeliveryStaffProfile(
        id: string,
        updateDeliveryStaffProfileInput: UpdateDeliveryStaffProfileInput,
    ) {
        return this.userService.updateDeliveryStaffProfile(
            id,
            updateDeliveryStaffProfileInput,
        )
    }

    async deleteDeliveryStaffProfile(id: string) {
        return this.userService.deleteDeliveryStaffProfile(id)
    }

    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userService.resolveReference(reference)
    }
}
