import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { GrpcServerService } from "libs/grpc"
import { envConfig } from "libs/env"
import { UserService } from "../user.service"
import { v7 as uuidv7 } from "uuid"


@Injectable()
export class UserGrpcService implements OnModuleInit {
    private readonly logger = new Logger(UserGrpcService.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly userService: UserService,
    ) {}

    async onModuleInit() {
        // Implementation will be provided when main.ts initializes the gRPC server
        this.logger.log("User gRPC service implementation ready")
        this.logger.log(
            `Will listen on port: ${process.env.USERS_GRPC_PORT || "50002"}`,
        )
    }

    public getImplementation() {
        return {
            // Health check (required)
            Health: this.health.bind(this),

            // User service methods
            CreateUser: this.createUser.bind(this),
            CreateStaffUser: this.createStaffUser.bind(this),
            GetUser: this.getUser.bind(this),
            UpdateUser: this.updateUser.bind(this),
            UserExists: this.userExists.bind(this),
            GetUserByEmail: this.getUserByEmail.bind(this),
        }
    }

    // Health check implementation
    private async health(call: any, callback: any) {
        const response = {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }

        callback(null, response)
    }

    // Create user from auth service
    private async createUser(call: any, callback: any) {
        try {
            const {
                cognito_id,
                email,
                username,
                full_name,
                phone_number,
                role,
                cognito_attributes,
            } = call.request

            if (!cognito_id || !email) {
                callback(null, {
                    success: false,
                    user: null,
                    error: "Cognito ID and email are required",
                })
                return
            }

            // Map role enum to string
            const roleMap = {
                0: "DONOR",
                1: "FUNDRAISER",
                2: "KITCHEN_STAFF",
                3: "DELIVERY_STAFF",
                4: "ADMIN",
            }

            const finalUsername =
                username || this.extractUsernameFromEmail(email)

            const user = await this.userService.createUser({
                cognito_id: cognito_id,
                email,
                user_name: finalUsername,
                full_name: full_name || "",
                phone_number: phone_number || "",
                avatar_url: cognito_attributes?.avatar_url || "",
                bio: cognito_attributes?.bio || "",
                role: roleMap[role] || "DONOR",
            })

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
                    username,
                    full_name: user.full_name,
                    phone_number: user.phone_number,
                    avatar_url: user.avatar_url || "",
                    bio: user.bio || "",
                    role:
                        Object.keys(roleMap).find(
                            (key) => roleMap[key] === user.role,
                        ) || 0,
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

    // Create staff user from admin service
    private async createStaffUser(call: any, callback: any) {
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
            if (
                !["KITCHEN_STAFF", "FUNDRAISER", "DELIVERY_STAFF"].includes(
                    staffRole,
                )
            ) {
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

            const user = await this.userService.createStaffUser({
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
                    role:
                        Object.keys(roleMap).find(
                            (key) => roleMap[key] === user.role,
                        ) || 0,
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

    private extractUsernameFromEmail(email: string): string {
        if (typeof email !== "string") return ""
        const atIndex = email.indexOf("@")
        if (atIndex <= 0) return ""
        // Lấy phần trước dấu @, cắt tối đa 20 ký tự
        return email.substring(0, atIndex).slice(0, 20)
    }

    // Get user by ID
    private async getUser(call: any, callback: any) {
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

            const user = await this.userService.findUserById(id)

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

    // Update user profile
    private async updateUser(call: any, callback: any) {
        try {
            const { id, full_name, phone_number, avatar_url, bio } =
                call.request

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

            const user = await this.userService.updateUser(id, updateData)

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

    // Check if user exists
    private async userExists(call: any, callback: any) {
        try {
            const { cognito_id } = call.request

            if (!cognito_id) {
                callback(null, {
                    exists: false,
                    user_id: "",
                })
                return
            }

            const user = await this.userService.findUserByCognitoId(cognito_id)

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

    // Get user by email
    private async getUserByEmail(call: any, callback: any) {
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

            const user = await this.userService.findUserByEmail(email)

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
}
