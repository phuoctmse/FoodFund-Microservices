import { UserCommonRepository } from "@app/user/src/domain/repositories"
import { Role } from "@libs/databases"
import { Injectable, Logger } from "@nestjs/common"
import { generateUniqueUsername } from "libs/common"

@Injectable()
export class UserCommonGrpcService {
    private readonly logger = new Logger(UserCommonGrpcService.name)

    constructor(private readonly userCommonRepository: UserCommonRepository) {}

    // Create user from auth service
    async createUser(call: any, callback: any) {
        try {
            // Proto loader converts to camelCase when keepCase=false
            const { cognitoId, email, fullName, cognitoAttributes } =
                call.request

            this.logger.debug(
                "CreateUser called:",
                JSON.stringify(call.request),
            )

            if (!cognitoId || !email) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Cognito ID and email are required",
                })
                return
            }

            const finalUsername = generateUniqueUsername(email)

            const user = await this.userCommonRepository.createUser({
                cognito_id: cognitoId,
                email,
                user_name: finalUsername,
                full_name: fullName || "",
                avatar_url: cognitoAttributes?.avatarUrl || "",
                bio: cognitoAttributes?.bio || "",
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

            // Return camelCase for gRPC
            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    cognitoId: user.cognito_id,
                    email: user.email,
                    username: finalUsername,
                    fullName: user.full_name,
                    phoneNumber: user.phone_number || "",
                    avatarUrl: user.avatar_url || "",
                    bio: user.bio || "",
                    role: 0, // DONOR = 0
                    isActive: user.is_active,
                    createdAt: user.created_at.toISOString(),
                    updatedAt: user.updated_at.toISOString(),
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

    // Get user by cognito_id
    async getUser(call: any, callback: any) {
        try {
            // Proto loader converts cognito_id to cognitoId when keepCase=false
            const { cognitoId } = call.request

            if (!cognitoId) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Cognito ID is required",
                })
                return
            }

            // Find user by cognito_id
            const user =
                await this.userCommonRepository.findUserByCognitoId(cognitoId)

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

            // Return camelCase for gRPC (proto loader will handle conversion)
            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    cognitoId: user.cognito_id,
                    email: user.email,
                    username: user.user_name,
                    fullName: user.full_name,
                    phoneNumber: user.phone_number || "",
                    avatarUrl: user.avatar_url || "",
                    bio: user.bio || "",
                    role: roleMap[user.role] || 0,
                    isActive: user.is_active,
                    createdAt: user.created_at.toISOString(),
                    updatedAt: user.updated_at.toISOString(),
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

            const roleMap = {
                DONOR: 0,
                FUNDRAISER: 1,
                KITCHEN_STAFF: 2,
                DELIVERY_STAFF: 3,
                ADMIN: 4,
            }

            // Return camelCase for gRPC
            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    cognitoId: user.cognito_id,
                    email: user.email,
                    username: user.user_name,
                    fullName: user.full_name,
                    phoneNumber: user.phone_number || "",
                    avatarUrl: user.avatar_url || "",
                    bio: user.bio || "",
                    role: roleMap[user.role] || 0,
                    isActive: user.is_active,
                    createdAt: user.created_at.toISOString(),
                    updatedAt: user.updated_at.toISOString(),
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
