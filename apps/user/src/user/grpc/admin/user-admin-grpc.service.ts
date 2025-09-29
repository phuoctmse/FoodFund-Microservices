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

    // Create staff user from admin service
    async createStaffUser(call: any, callback: any) {
        try {
            const {
                cognito_id,
                email,
                username,
                full_name,
                phone_number,
                avatar_url,
                role,
                bio,
                organization_address,
            } = call.request

            if (!cognito_id || !email || !full_name || !username) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Cognito ID, email, full name, and username are required",
                })
                return
            }

            // Map role enum to string
            const roleMap = {
                DONOR: "DONOR",
                FUNDRAISER: "FUNDRAISER", 
                KITCHEN_STAFF: "KITCHEN_STAFF",
                DELIVERY_STAFF: "DELIVERY_STAFF",
                ADMIN: "ADMIN",
            }

            const staffRole = roleMap[role]

            // Validate that it's a staff role
            if (!["KITCHEN_STAFF", "FUNDRAISER", "DELIVERY_STAFF"].includes(staffRole)) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Invalid staff role. Must be KITCHEN_STAFF, FUNDRAISER, or DELIVERY_STAFF",
                })
                return
            }

            this.logger.log("Creating staff user:", {
                cognito_id,
                email,
                user_name: username,
                full_name,
                phone_number: phone_number || "",
                avatar_url: avatar_url || "",
                bio: bio || "",
                role: staffRole,
                organization_address,
            })

            const user = await this.userAdminRepository.createStaffUser({
                cognito_id,
                email,
                user_name: username,
                full_name,
                phone_number: phone_number || "",
                avatar_url: avatar_url || "",
                bio: bio || "",
                role: staffRole as any,
                organization_address,
            })

            if (!user) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Failed to create staff user",
                })
                return
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
                    role: Object.keys(roleMap).find(key => roleMap[key] === user.role) || 0,
                    is_active: user.is_active,
                    created_at: user.created_at.toISOString(),
                    updated_at: user.updated_at.toISOString(),
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Create staff user failed:", error)
            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }

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

    // Create Staff Account (Admin function with full Cognito integration)
    async createStaffAccount(call: any, callback: any) {
        try {
            const {
                admin_user_id,
                full_name,
                email,
                password,
                phone_number,
                role,
                avatar_url,
                bio,
                organization_address,
            } = call.request

            this.logger.log(`gRPC CreateStaffAccount called by admin: ${admin_user_id} for ${email}`)

            // Convert proto role enum to Role enum
            const roleMapping = {
                0: "DONOR",
                1: "FUNDRAISER",
                2: "KITCHEN_STAFF", 
                3: "DELIVERY_STAFF",
                4: "ADMIN",
            }

            const result = await this.userAdminService.createStaffAccount(
                {
                    full_name,
                    email,
                    password,
                    phone_number,
                    role: roleMapping[role],
                    avatar_url,
                    bio,
                    organization_address,
                },
                admin_user_id,
            )

            callback(null, {
                success: result.success,
                message: result.message,
                userId: result.userId,
                cognitoId: result.cognitoId,
                hasLoginAccess: result.hasLoginAccess,
                temporaryPasswordSent: result.temporaryPasswordSent,
                error: null,
            })
        } catch (error) {
            this.logger.error("Create staff account failed:", error)
            callback(null, {
                success: false,
                message: "",
                userId: "",
                cognitoId: "",
                hasLoginAccess: false,
                temporaryPasswordSent: false,
                error: error.message,
            })
        }
    }
}