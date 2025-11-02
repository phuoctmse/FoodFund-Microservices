import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import { UserApplicationService } from "../../../application/services"
import {
    CreateUserRequest,
    CreateUserResponse,
    CreateStaffUserRequest,
    CreateStaffUserResponse,
    GetUserRequest,
    GetUserResponse,
    UpdateUserRequest,
    UpdateUserResponse,
    UserExistsRequest,
    UserExistsResponse,
    GetUserByEmailRequest,
} from "libs/grpc/interfaces/user-grpc.interface"

/**
 * Presentation Controller: User gRPC
 * Handles gRPC requests for user service using NestJS Microservices
 */
@Controller()
export class UserGrpcController {
    private readonly logger = new Logger(UserGrpcController.name)

    constructor(
        private readonly userApplicationService: UserApplicationService,
    ) {}

    @GrpcMethod("UserService", "CreateUser")
    async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
        try {
            this.logger.log(`gRPC CreateUser: ${data.email}`)

            if (!data.cognito_id || !data.email || !data.username) {
                return {
                    success: false,
                    user: null,
                    error: "cognito_id, email, and username are required",
                }
            }

            const user = await this.userApplicationService.createUser({
                cognitoId: data.cognito_id,
                email: data.email,
                username: data.username,
                fullName: data.full_name || data.username,
            })

            return {
                success: true,
                user: this.mapUserToGrpc(user),
                error: null,
            }
        } catch (error) {
            this.logger.error("Create user failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create user",
            }
        }
    }

    @GrpcMethod("UserService", "CreateStaffUser")
    async createStaffUser(
        data: CreateStaffUserRequest,
    ): Promise<CreateStaffUserResponse> {
        try {
            this.logger.log(`gRPC CreateStaffUser: ${data.email}`)

            if (!data.cognito_id || !data.email || !data.username) {
                return {
                    success: false,
                    user: null,
                    error: "cognito_id, email, and username are required",
                }
            }

            const user = await this.userApplicationService.createUser({
                cognitoId: data.cognito_id,
                email: data.email,
                username: data.username,
                fullName: data.full_name || data.username,
                role: this.mapGrpcRoleToEnum(data.role) as any,
            })

            return {
                success: true,
                user: this.mapUserToGrpc(user),
                error: null,
            }
        } catch (error) {
            this.logger.error("Create staff user failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to create staff user",
            }
        }
    }

    @GrpcMethod("UserService", "GetUser")
    async getUser(data: GetUserRequest): Promise<GetUserResponse> {
        try {
            this.logger.log(`gRPC GetUser: ${data.id}`)

            if (!data.id) {
                return {
                    success: false,
                    user: null,
                    error: "User ID is required",
                }
            }

            const user = await this.userApplicationService.getUserById(data.id)

            return {
                success: true,
                user: this.mapUserToGrpc(user),
                error: null,
            }
        } catch (error) {
            this.logger.error("Get user failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to get user",
            }
        }
    }

    @GrpcMethod("UserService", "UpdateUser")
    async updateUser(data: UpdateUserRequest): Promise<UpdateUserResponse> {
        try {
            this.logger.log(`gRPC UpdateUser: ${data.id}`)

            if (!data.id) {
                return {
                    success: false,
                    user: null,
                    error: "User ID is required",
                }
            }

            const updateData: any = {}
            if (data.full_name) updateData.fullName = data.full_name
            if (data.phone_number) updateData.phoneNumber = data.phone_number
            if (data.avatar_url) updateData.avatarUrl = data.avatar_url
            if (data.bio) updateData.bio = data.bio

            const user = await this.userApplicationService.updateUser(
                data.id,
                updateData,
            )

            return {
                success: true,
                user: this.mapUserToGrpc(user),
                error: null,
            }
        } catch (error) {
            this.logger.error("Update user failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to update user",
            }
        }
    }

    @GrpcMethod("UserService", "UserExists")
    async userExists(data: UserExistsRequest): Promise<UserExistsResponse> {
        try {
            this.logger.log(
                `gRPC UserExists: ${data.cognito_id || data.email}`,
            )

            let exists = false

            if (data.cognito_id) {
                const user =
                    await this.userApplicationService.getUserByCognitoId(
                        data.cognito_id,
                    )
                exists = !!user
            } else if (data.email) {
                const user =
                    await this.userApplicationService.getUserByEmail(data.email)
                exists = !!user
            }

            return {
                exists,
                error: null,
            }
        } catch (error) {
            this.logger.error("User exists check failed:", error)
            return {
                exists: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to check user existence",
            }
        }
    }

    @GrpcMethod("UserService", "GetUserByEmail")
    async getUserByEmail(
        data: GetUserByEmailRequest,
    ): Promise<GetUserResponse> {
        try {
            this.logger.log(`gRPC GetUserByEmail: ${data.email}`)

            if (!data.email) {
                return {
                    success: false,
                    user: null,
                    error: "Email is required",
                }
            }

            const user =
                await this.userApplicationService.getUserByEmail(data.email)

            return {
                success: true,
                user: this.mapUserToGrpc(user),
                error: null,
            }
        } catch (error) {
            this.logger.error("Get user by email failed:", error)
            return {
                success: false,
                user: null,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to get user",
            }
        }
    }

    // Helper: Map User entity to gRPC format
    private mapUserToGrpc(user: any) {
        return {
            id: user.id,
            cognito_id: user.cognitoId,
            email: user.email,
            username: user.username,
            full_name: user.fullName,
            phone_number: user.phoneNumber || "",
            avatar_url: user.avatarUrl || "",
            bio: user.bio || "",
            role: this.mapRoleToGrpc(user.role),
            is_active: user.isActive,
            created_at: user.createdAt?.toISOString() || "",
            updated_at: user.updatedAt?.toISOString() || "",
        }
    }

    // Helper: Map Role enum to gRPC enum
    private mapRoleToGrpc(role: string): number {
        const roleMap: Record<string, number> = {
            DONOR: 0,
            FUNDRAISER: 1,
            KITCHEN_STAFF: 2,
            DELIVERY_STAFF: 3,
            ADMIN: 4,
        }
        return roleMap[role] || 0
    }

    // Helper: Map gRPC role to Role enum
    private mapGrpcRoleToEnum(grpcRole: number): string {
        const roleMap: Record<number, string> = {
            0: "DONOR",
            1: "FUNDRAISER",
            2: "KITCHEN_STAFF",
            3: "DELIVERY_STAFF",
            4: "ADMIN",
        }
        return roleMap[grpcRole] || "DONOR"
    }
}
