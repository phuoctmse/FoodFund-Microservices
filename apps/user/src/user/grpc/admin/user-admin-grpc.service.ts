import { Injectable, Logger } from "@nestjs/common"
import { UserAdminRepository } from "../../repositories/admin"
import { UserAdminService } from "../../services/admin"
import { AwsCognitoService } from "libs/aws-cognito"
import { envConfig } from "libs/env"

@Injectable()
export class UserAdminGrpcService {
    private readonly logger = new Logger(UserAdminGrpcService.name)

    constructor(
        private readonly userAdminRepository: UserAdminRepository,
        private readonly userAdminService: UserAdminService,
    ) {}

    // Update user profile
    async updateUser(call: any, callback: any) {
        try {
            const { id, full_name, phone_number, avatar_url, bio } = call.request

            if (!id) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "User ID is required",
                })
                return
            }

            const updateData: any = {}
            if (full_name) updateData.full_name = full_name
            if (phone_number) updateData.phone_number = phone_number
            if (avatar_url) updateData.avatar_url = avatar_url
            if (bio) updateData.bio = bio

            const user = await this.userAdminRepository.updateUser(id, updateData)

            const roleMap = {
                DONOR: 0,
                FUNDRAISER: 1,
                KITCHEN_STAFF: 2,
                DELIVERY_STAFF: 3,
                ADMIN: 4,
            }

            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    cognito_id: user.cognito_id,
                    email: user.email,
                    username: user.user_name,
                    full_name: user.full_name,
                    phone_number: user.phone_number,
                    avatar_url: user.avatar_url || "",
                    bio: user.bio || "",
                    role: roleMap[user.role] || 0,
                    is_active: user.is_active,
                    created_at: user.created_at.toISOString(),
                    updated_at: user.updated_at.toISOString(),
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Update user failed:", error)
            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }


}