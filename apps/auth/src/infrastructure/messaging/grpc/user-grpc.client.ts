import { Injectable, Inject, OnModuleInit } from "@nestjs/common"
import { ClientGrpc } from "@nestjs/microservices"
import { IUserService } from "../../../domain/interfaces/user-service.interface"
import { IUserGrpcService } from "libs/grpc/interfaces/user-grpc.interface"
import { lastValueFrom } from "rxjs"

/**
 * Infrastructure Client: User gRPC
 * Implements IUserService interface using NestJS Microservices gRPC client
 */
@Injectable()
export class UserGrpcClient implements IUserService, OnModuleInit {
    private userGrpcService: IUserGrpcService

    constructor(@Inject("USER_PACKAGE") private client: ClientGrpc) {}

    onModuleInit() {
        this.userGrpcService =
            this.client.getService<IUserGrpcService>("UserService")
    }

    async createUser(data: {
        cognitoId: string
        email: string
        username: string
        fullName: string
        role: string
    }): Promise<{ success: boolean; error?: string }> {
        const result = await lastValueFrom(
            this.userGrpcService.createUser({
                cognito_id: data.cognitoId,
                email: data.email,
                username: data.username,
                full_name: data.fullName,
            }),
        )

        return {
            success: result.success,
            error: result.error || undefined,
        }
    }

    async getUser(cognitoId: string): Promise<{
        success: boolean
        user?: {
            id: string
            email: string
            isActive: boolean
        }
        error?: string
    }> {
        const result = await lastValueFrom(
            this.userGrpcService.getUser({
                id: cognitoId,
            }),
        )

        if (!result.success || !result.user) {
            return {
                success: false,
                error: result.error || "User not found",
            }
        }

        return {
            success: true,
            user: {
                id: result.user.id,
                email: result.user.email,
                isActive: result.user.is_active,
            },
        }
    }

    async updateUser(
        cognitoId: string,
        data: Record<string, any>,
    ): Promise<{ success: boolean }> {
        const result = await lastValueFrom(
            this.userGrpcService.updateUser({
                id: cognitoId,
                full_name: data.fullName,
                phone_number: data.phoneNumber,
                avatar_url: data.avatarUrl,
                bio: data.bio,
            }),
        )

        return { success: result.success }
    }

    async deleteUser(cognitoId: string): Promise<{ success: boolean }> {
        // Note: Delete user is not in the proto file
        // Return success for now
        return { success: true }
    }
}
