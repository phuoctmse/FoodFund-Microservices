import { Injectable, Logger } from "@nestjs/common"
import { UserCommonRepository } from "../../repositories/common"
import { generateUniqueUsername } from "libs/common"
import { Role } from "../../enums/user.enum"

@Injectable()
export class UserCommonGrpcService {
    private readonly logger = new Logger(UserCommonGrpcService.name)

    constructor(private readonly userCommonRepository: UserCommonRepository) {}

    // Create user from auth service
    async createUser(call: any, callback: any) {
        try {
            const { cognito_id, email, full_name, cognito_attributes } =
                call.request

            if (!cognito_id || !email) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Cognito ID and email are required",
                })
                return
            }

            const finalUsername = generateUniqueUsername(email)

            const user = await this.userCommonRepository.createUser({
                cognito_id,
                email,
                user_name: finalUsername,
                full_name: full_name || "",
                avatar_url: cognito_attributes?.avatar_url || "",
                bio: cognito_attributes?.bio || "",
                role: Role.DONOR,
            } as any)

            if (!user) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Failed to create user",
                })
                return
            }

            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    cognito_id: user.cognito_id,
                    email: user.email,
                    username: finalUsername,
                    full_name: user.full_name,
                    phone_number: user.phone_number,
                    avatar_url: user.avatar_url || "",
                    bio: user.bio || "",
                    role: Role.DONOR,
                    is_active: user.is_active,
                    created_at: user.created_at.toISOString(),
                    updated_at: user.updated_at.toISOString(),
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Create user failed:", error)
            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }

    // Get user by ID
    async getUser(call: any, callback: any) {
        try {
            const { id } = call.request

            if (!id) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "User ID is required",
                })
                return
            }

            const user = await this.userCommonRepository.findUserById(id)

            if (!user) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "User not found",
                })
                return
            }

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
            this.logger.error("Get user failed:", error)
            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }

    // Get user by email
    async getUserByEmail(call: any, callback: any) {
        try {
            const { email } = call.request

            if (!email) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Email is required",
                })
                return
            }

            const user = await this.userCommonRepository.findUserByEmail(email)

            if (!user) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "User not found",
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
                    role: user.role,
                    is_active: user.is_active,
                    created_at: user.created_at.toISOString(),
                    updated_at: user.updated_at.toISOString(),
                },
                error: null,
            })
        } catch (error) {
            this.logger.error("Get user by email failed:", error)
            callback(null, {
                success: false,
                user: null,
                error: error.message,
            })
        }
    }

    // Check if user exists
    async userExists(call: any, callback: any) {
        try {
            const { cognito_id } = call.request

            if (!cognito_id) {
                callback(null, {
                    exists: false,
                    user_id: "",
                })
                return
            }

            const user =
                await this.userCommonRepository.findUserByCognitoId(cognito_id)

            callback(null, {
                exists: !!user,
                user_id: user?.id || "",
            })
        } catch (error) {
            this.logger.error("User exists check failed:", error)
            callback(null, {
                exists: false,
                user_id: "",
            })
        }
    }
}
