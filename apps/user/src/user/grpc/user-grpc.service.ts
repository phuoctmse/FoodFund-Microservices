import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { GrpcServerService } from "libs/grpc"
import { envConfig } from "libs/env"
import { UserCommonGrpcService } from "./common"
import { UserAdminGrpcService } from "./admin"
import { generateUniqueUsername } from "libs/common"
import { v7 as uuidv7 } from "uuid"

@Injectable()
export class UserGrpcService implements OnModuleInit {
    private readonly logger = new Logger(UserGrpcService.name)

    constructor(
        private readonly grpcServer: GrpcServerService,
        private readonly userCommonGrpcService: UserCommonGrpcService,
        private readonly userAdminGrpcService: UserAdminGrpcService,
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
        return this.userCommonGrpcService.createUser(call, callback)
    }


    // Get user by ID
    private async getUser(call: any, callback: any) {
        return this.userCommonGrpcService.getUser(call, callback)
    }

    // Update user profile
    private async updateUser(call: any, callback: any) {
        return this.userAdminGrpcService.updateUser(call, callback)
    }

    // Check if user exists
    private async userExists(call: any, callback: any) {
        return this.userCommonGrpcService.userExists(call, callback)
    }

    // Get user by email
    private async getUserByEmail(call: any, callback: any) {
        return this.userCommonGrpcService.getUserByEmail(call, callback)
    }

}
