import { Injectable, Logger } from "@nestjs/common"
import { UserAdminRepository } from "../../repositories/admin"
import { UserAdminService } from "../../services/admin"
import { Role } from "libs/databases/prisma/schemas"

// Constants to avoid duplication
const ROLE_TO_GRPC_MAP = {
    [Role.DONOR]: 0,
    [Role.FUNDRAISER]: 1,
    [Role.KITCHEN_STAFF]: 2,
    [Role.DELIVERY_STAFF]: 3,
    [Role.ADMIN]: 4,
} as const

@Injectable()
export class UserAdminGrpcService {
    private readonly logger = new Logger(UserAdminGrpcService.name)

    constructor(
        private readonly userAdminRepository: UserAdminRepository,
        private readonly userAdminService: UserAdminService,
    ) {}

    /**
     * Transform database user to gRPC user format
     * Reduces code duplication across methods
     */
    private transformUserToGrpcFormat(user: any) {
        return {
            id: user.id,
            cognito_id: user.cognito_id,
            email: user.email,
            username: user.user_name,
            full_name: user.full_name,
            phone_number: user.phone_number,
            avatar_url: user.avatar_url || "",
            bio: user.bio || "",
            role: ROLE_TO_GRPC_MAP[user.role as Role] ?? 0,
            is_active: user.is_active,
            created_at: user.created_at.toISOString(),
            updated_at: user.updated_at.toISOString(),
        }
    }

    /**
     * Standard success response helper
     */
    private createSuccessResponse(user: any) {
        return {
            success: true,
            user: this.transformUserToGrpcFormat(user),
            error: null,
        }
    }

    /**
     * Standard error response helper
     */
    private createErrorResponse(errorMessage: string) {
        return {
            success: false,
            user: null,
            error: errorMessage,
        }
    }

    // Update user profile
    async updateUser(call: any, callback: any) {
        try {
            const { id, full_name, phone_number, avatar_url, bio } = call.request

            if (!id) {
                callback(null, this.createErrorResponse("User ID is required"))
                return
            }

            const updateData: any = {}
            if (full_name) updateData.full_name = full_name
            if (phone_number) updateData.phone_number = phone_number
            if (avatar_url) updateData.avatar_url = avatar_url
            if (bio) updateData.bio = bio

            const user = await this.userAdminRepository.updateUser(id, updateData)
            callback(null, this.createSuccessResponse(user))

        } catch (error) {
            this.logger.error("Update user failed:", error)
            callback(null, this.createErrorResponse(error.message))
        }
    }


}