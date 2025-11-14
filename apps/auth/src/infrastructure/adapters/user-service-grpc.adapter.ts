import { Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { GrpcClientService } from "libs/grpc"
import {
    GetUserResponse,
    IUserService,
    UserDto,
} from "../../domain/interfaces"

/**
 * gRPC Adapter for User Service Communication
 * This is the concrete implementation of IUserServicePort using gRPC
 */
@Injectable()
export class UserServiceGrpcAdapter implements IUserService {
    private readonly logger = new Logger(UserServiceGrpcAdapter.name)

    constructor(private readonly grpcClient: GrpcClientService) {}

    async getUserByCognitoId(cognitoId: string): Promise<GetUserResponse> {
        try {
            this.logger.log(`Fetching user from User Service: ${cognitoId}`)

            // Use camelCase because proto loader converts with keepCase=false
            const response = await this.grpcClient.callUserService("GetUser", {
                cognitoId: cognitoId,
            })

            if (!response.success || !response.user) {
                return {
                    success: false,
                    message: "User not found in User Service",
                }
            }

            const userDto: UserDto = {
                id: response.user.id,
                cognitoId: response.user.cognitoId,
                email: response.user.email,
                isActive: response.user.isActive,
            }

            return {
                success: true,
                user: userDto,
            }
        } catch (error) {
            this.logger.error(
                `Failed to fetch user from User Service: ${error instanceof Error ? error.message : error}`,
            )

            return {
                success: false,
                message: `Failed to communicate with User Service: ${error instanceof Error ? error.message : "Unknown error"}`,
            }
        }
    }

    async isUserActive(cognitoId: string): Promise<boolean> {
        try {
            this.logger.log(`Checking if user is active: ${cognitoId}`)

            const response = await this.getUserByCognitoId(cognitoId)

            if (!response.success || !response.user) {
                this.logger.warn(`User not found in User Service: ${cognitoId}`)
                throw new UnauthorizedException(
                    "User account not found. Please contact support.",
                )
            }

            if (!response.user.isActive) {
                this.logger.warn(
                    `User account is inactive: ${cognitoId} (${response.user.email})`,
                )
                throw new UnauthorizedException(
                    "Your account has been deactivated. Please contact support for assistance.",
                )
            }

            this.logger.log(`User is active: ${cognitoId}`)
            return true
        } catch (error) {
            // If it's already an UnauthorizedException, rethrow it
            if (error instanceof UnauthorizedException) {
                throw error
            }

            // Log other errors
            this.logger.error(
                `Failed to validate user active status: ${error instanceof Error ? error.message : error}`,
            )
            throw new UnauthorizedException("Unable to verify account status.")
        }
    }
}

