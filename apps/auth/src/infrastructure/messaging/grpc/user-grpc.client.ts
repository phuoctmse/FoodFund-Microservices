import { Injectable } from "@nestjs/common"
import { GrpcClientService } from "libs/grpc"
import { IUserService } from "../../../domain/interfaces/user-service.interface"

/**
 * Infrastructure Client: User gRPC
 * Implements IUserService interface using gRPC
 */
@Injectable()
export class UserGrpcClient implements IUserService {
    constructor(private readonly grpcClient: GrpcClientService) {}

    async createUser(data: {
        cognitoId: string
        email: string
        username: string
        fullName: string
        role: string
    }): Promise<{ success: boolean; error?: string }> {
        const result = await this.grpcClient.callUserService("CreateUser", {
            cognito_id: data.cognitoId,
            email: data.email,
            username: data.username,
            full_name: data.fullName,
            role: data.role,
        })

        return {
            success: result.success,
            error: result.error,
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
        const result = await this.grpcClient.callUserService("GetUser", {
            cognito_id: cognitoId,
        })

        if (!result.success) {
            return {
                success: false,
                error: result.error,
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
        const result = await this.grpcClient.callUserService("UpdateUser", {
            cognito_id: cognitoId,
            ...data,
        })

        return { success: result.success }
    }

    async deleteUser(cognitoId: string): Promise<{ success: boolean }> {
        const result = await this.grpcClient.callUserService("DeleteUser", {
            cognito_id: cognitoId,
        })

        return { success: result.success }
    }
}
