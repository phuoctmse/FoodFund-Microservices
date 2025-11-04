import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import { UserCommonGrpcService } from "./common"
import { UserAdminGrpcService } from "./admin"

// Request/Response interfaces matching proto definitions
interface CreateUserRequest {
    cognito_id: string
    email: string
    username: string
    full_name: string
    role: string
}

interface CreateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface GetUserRequest {
    cognito_id: string // Primary identifier
}

interface GetUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface UpdateUserRequest {
    cognito_id: string
    full_name?: string
    avatar_url?: string
    phone_number?: string
    address?: string
    bio?: string
}

interface UpdateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface UserExistsRequest {
    cognito_id: string
}

interface UserExistsResponse {
    exists: boolean
    error: string | null
}

interface GetUserByEmailRequest {
    email: string
}

interface GetUserByEmailResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface HealthResponse {
    status: string
    service: string
    timestamp: string
    uptime: number
}

@Controller()
export class UserGrpcController {
    private readonly logger = new Logger(UserGrpcController.name)

    constructor(
        private readonly userCommonGrpcService: UserCommonGrpcService,
        private readonly userAdminGrpcService: UserAdminGrpcService,
    ) {}

    @GrpcMethod("UserService", "Health")
    async health(): Promise<HealthResponse> {
        return {
            status: "healthy",
            service: "user-service",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        }
    }

    @GrpcMethod("UserService", "CreateUser")
    async createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
        return new Promise((resolve, reject) => {
            this.userCommonGrpcService.createUser(
                { request: data },
                (error: any, response: CreateUserResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }

    @GrpcMethod("UserService", "GetUser")
    async getUser(data: GetUserRequest): Promise<GetUserResponse> {
        return new Promise((resolve, reject) => {
            this.userCommonGrpcService.getUser(
                { request: data },
                (error: any, response: GetUserResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }

    @GrpcMethod("UserService", "UpdateUser")
    async updateUser(data: UpdateUserRequest): Promise<UpdateUserResponse> {
        return new Promise((resolve, reject) => {
            this.userAdminGrpcService.updateUser(
                { request: data },
                (error: any, response: UpdateUserResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }

    @GrpcMethod("UserService", "UserExists")
    async userExists(data: UserExistsRequest): Promise<UserExistsResponse> {
        return new Promise((resolve, reject) => {
            this.userCommonGrpcService.userExists(
                { request: data },
                (error: any, response: UserExistsResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }

    @GrpcMethod("UserService", "GetUserByEmail")
    async getUserByEmail(
        data: GetUserByEmailRequest,
    ): Promise<GetUserByEmailResponse> {
        return new Promise((resolve, reject) => {
            this.userCommonGrpcService.getUserByEmail(
                { request: data },
                (error: any, response: GetUserByEmailResponse) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(response)
                    }
                },
            )
        })
    }
}
