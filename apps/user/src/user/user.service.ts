import { Injectable } from "@nestjs/common"
import {
    CreateUserInput,
    CreateStaffUserInput,
    UpdateUserInput,
    UpdateDonorProfileInput,
    UpdateKitchenStaffProfileInput,
    UpdateFundraiserProfileInput,
    UpdateDeliveryStaffProfileInput,
} from "./user.repository"

// Import GraphQL models from shared libs for response typing
import { Role } from "libs/databases/prisma/schemas"
import { UserHealthResponse } from "./types/health-response.model"
import {
    UserCreationService,
    UserQueryService,
    UserUpdateService,
} from "./services"

@Injectable()
export class UserService {
    constructor(
        private readonly userCreationService: UserCreationService,
        private readonly userQueryService: UserQueryService,
        private readonly userUpdateService: UserUpdateService,
    ) {}

    // User CRUD operations
    async createUser(createUserInput: CreateUserInput) {
        return this.userCreationService.createUser(createUserInput)
    }

    async createStaffUser(createStaffUserInput: CreateStaffUserInput) {
        return this.userCreationService.createStaffUser(createStaffUserInput)
    }

    async findAllUsers(skip?: number, take?: number) {
        return this.userQueryService.findAllUsers(skip, take)
    }

    async findUserById(id: string) {
        return this.userQueryService.findUserById(id)
    }

    async findUserByEmail(email: string) {
        return this.userQueryService.findUserByEmail(email)
    }

    async findUserByUsername(user_name: string) {
        return this.userQueryService.findUserByUsername(user_name)
    }

    async findUserByCognitoId(cognito_id: string) {
        return this.userQueryService.findUserByCognitoId(cognito_id)
    }

    async updateUser(id: string, updateUserInput: UpdateUserInput) {
        return this.userUpdateService.updateUser(id, updateUserInput)
    }

    async deleteUser(id: string) {
        return this.userUpdateService.deleteUser(id)
    }

    async softDeleteUser(id: string) {
        return this.userUpdateService.softDeleteUser(id)
    }

    // Profile operations - delegate to update service
    async updateDonorProfile(
        id: string,
        updateDonorProfileInput: UpdateDonorProfileInput,
    ) {
        return this.userUpdateService.updateDonorProfile(
            id,
            updateDonorProfileInput,
        )
    }

    async deleteDonorProfile(id: string) {
        return this.userUpdateService.deleteDonorProfile(id)
    }

    async updateKitchenStaffProfile(
        id: string,
        updateKitchenStaffProfileInput: UpdateKitchenStaffProfileInput,
    ) {
        return this.userUpdateService.updateKitchenStaffProfile(
            id,
            updateKitchenStaffProfileInput,
        )
    }

    async deleteKitchenStaffProfile(id: string) {
        return this.userUpdateService.deleteKitchenStaffProfile(id)
    }

    async updateFundraiserProfile(
        id: string,
        updateFundraiserProfileInput: UpdateFundraiserProfileInput,
    ) {
        return this.userUpdateService.updateFundraiserProfile(
            id,
            updateFundraiserProfileInput,
        )
    }

    async deleteFundraiserProfile(id: string) {
        return this.userUpdateService.deleteFundraiserProfile(id)
    }

    async updateDeliveryStaffProfile(
        id: string,
        updateDeliveryStaffProfileInput: UpdateDeliveryStaffProfileInput,
    ) {
        return this.userUpdateService.updateDeliveryStaffProfile(
            id,
            updateDeliveryStaffProfileInput,
        )
    }

    async deleteDeliveryStaffProfile(id: string) {
        return this.userUpdateService.deleteDeliveryStaffProfile(id)
    }

    // Search and filter operations - delegate to query service
    async searchUsers(searchTerm: string, role?: Role) {
        return this.userQueryService.searchUsers(searchTerm, role)
    }

    async getUsersByRole(role: Role) {
        return this.userQueryService.getUsersByRole(role)
    }

    async getActiveUsers() {
        return this.userQueryService.getActiveUsers()
    }

    // For GraphQL Federation - resolver reference
    async resolveReference(reference: { __typename: string; id: string }) {
        return this.userQueryService.resolveReference(reference)
    }

    /**
     * Health check endpoint
     */
    getHealth(): UserHealthResponse {
        return {
            status: "healthy",
            service: "User Subgraph",
            timestamp: new Date().toISOString(),
        }
    }
}
