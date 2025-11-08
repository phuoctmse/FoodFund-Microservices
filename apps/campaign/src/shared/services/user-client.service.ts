import { Injectable, Logger } from "@nestjs/common"
import { GrpcClientService } from "@libs/grpc"

interface UserProfile {
    id: string
    fullName?: string
    username?: string
    email?: string
}

@Injectable()
export class UserClientService {
    private readonly logger = new Logger(UserClientService.name)

    constructor(private readonly grpcClient: GrpcClientService) {}

    async getUserById(userId: string): Promise<UserProfile | null> {
        try {
            const response = await this.grpcClient.callUserService<
                { id: string },
                {
                    success: boolean
                    user?: {
                        id: string
                        full_name: string
                        username: string
                        email: string
                    }
                    error?: string
                }
            >("GetUser", { id: userId }, { timeout: 3000, retries: 2 })

            if (!response.success || !response.user) {
                this.logger.warn(
                    `Failed to fetch user ${userId}: ${response.error || "User not found"}`,
                )
                return null
            }

            return {
                id: response.user.id,
                fullName: response.user.full_name,
                username: response.user.username,
                email: response.user.email,
            }
        } catch (error) {
            this.logger.error(`Error fetching user ${userId}:`, error)
            return null
        }
    }

    async getUserName(userId: string): Promise<string | null> {
        const user = await this.getUserById(userId)
        return user?.fullName || user?.username || null
    }

    async getUserByCognitoId(cognitoId: string): Promise<UserProfile | null> {
        try {
            // Use GetUser method with cognito_id parameter
            // According to user.proto: GetUserRequest has optional cognito_id field
            const response = await this.grpcClient.callUserService<
                { id?: string; cognito_id?: string },
                {
                    success: boolean
                    user?: {
                        id: string
                        cognito_id: string
                        full_name: string
                        username: string
                        email: string
                    }
                    error?: string
                }
            >(
                "GetUser",
                { cognito_id: cognitoId },
                { timeout: 3000, retries: 2 },
            )

            if (!response.success || !response.user) {
                this.logger.warn(
                    `Failed to fetch user by Cognito ID ${cognitoId}: ${response.error || "User not found"}`,
                )
                return null
            }

            return {
                id: response.user.id,
                fullName: response.user.full_name,
                username: response.user.username,
                email: response.user.email,
            }
        } catch (error) {
            this.logger.error(
                `Error fetching user by Cognito ID ${cognitoId}:`,
                error,
            )
            return null
        }
    }

    async getUserNameByCognitoId(cognitoId: string): Promise<string | null> {
        const user = await this.getUserByCognitoId(cognitoId)
        return user?.fullName || user?.username || null
    }

    /**
     * Batch fetch users by IDs (for optimization)
     * Returns a map of userId -> userName
     */
    async getUserNamesByIds(userIds: string[]): Promise<Map<string, string>> {
        const userNameMap = new Map<string, string>()

        if (userIds.length === 0) return userNameMap

        // Fetch users in parallel (batch)
        const userPromises = userIds.map((userId) =>
            this.getUserById(userId).catch((error) => {
                this.logger.warn(`Failed to fetch user ${userId}:`, error)
                return null
            }),
        )

        const users = await Promise.all(userPromises)

        // Build map
        users.forEach((user, index) => {
            if (user) {
                const userName =
                    user.fullName || user.username || "Unknown Donor"
                userNameMap.set(userIds[index], userName)
            }
        })

        return userNameMap
    }

    /**
     * Credit Fundraiser Wallet after successful PayOS payment
     * Calls User service via gRPC to create wallet transaction
     */
    async creditFundraiserWallet(data: {
        fundraiser_id: string
        campaign_id: string
        payment_transaction_id: string
        amount: bigint
        gateway: string
        description?: string
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Calling CreditFundraiserWallet for fundraiser ${data.fundraiser_id}`,
            )

            const response = await this.grpcClient.callUserService<
                {
                    fundraiserId: string
                    campaignId: string
                    paymentTransactionId: string
                    amount: string // gRPC uses string for bigint
                    gateway: string
                    description?: string
                },
                {
                    success: boolean
                    walletTransactionId?: string
                    error?: string
                }
            >(
                "CreditFundraiserWallet",
                {
                    fundraiserId: data.fundraiser_id,
                    campaignId: data.campaign_id,
                    paymentTransactionId: data.payment_transaction_id,
                    amount: data.amount.toString(), // Convert bigint to string for gRPC
                    gateway: data.gateway,
                    description: data.description,
                },
                { timeout: 5000, retries: 3 }, // Higher timeout for wallet operations
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to credit fundraiser wallet",
                )
            }

            this.logger.log(
                `[gRPC] ✅ Fundraiser wallet credited - Transaction ID: ${response.walletTransactionId}`,
            )
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to credit fundraiser wallet for ${data.fundraiser_id}:`,
                error,
            )
            throw error
        }
    }

    /**
     * Credit Admin Wallet for Sepay incoming transfers (catch-all)
     * Calls User service via gRPC to create wallet transaction for Admin
     */
    async creditAdminWallet(data: {
        admin_id: string
        campaign_id: string | null
        payment_transaction_id: string | null
        amount: bigint
        gateway: string
        description?: string
        sepay_metadata?: {
            sepay_id: number
            reference_code: string
            content: string
            bank_name: string
            transaction_date: string
            accumulated: number
            sub_account: string | null
            description: string
        }
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Calling CreditAdminWallet for admin ${data.admin_id}`,
            )

            const response = await this.grpcClient.callUserService<
                {
                    adminId: string
                    campaignId: string | null
                    paymentTransactionId: string | null
                    amount: string // gRPC uses string for bigint
                    gateway: string
                    description?: string
                    sepayMetadata?: string // JSONB as string
                },
                {
                    success: boolean
                    walletTransactionId?: string
                    error?: string
                }
            >(
                "CreditAdminWallet",
                {
                    adminId: data.admin_id,
                    campaignId: data.campaign_id,
                    paymentTransactionId: data.payment_transaction_id,
                    amount: data.amount.toString(), // Convert bigint to string for gRPC
                    gateway: data.gateway,
                    description: data.description,
                    sepayMetadata: data.sepay_metadata
                        ? JSON.stringify(data.sepay_metadata)
                        : undefined, // Serialize JSONB to string
                },
                { timeout: 5000, retries: 3 }, // Higher timeout for wallet operations
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to credit admin wallet",
                )
            }

            this.logger.log(
                `[gRPC] ✅ Admin wallet credited - Transaction ID: ${response.walletTransactionId}`,
            )
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to credit admin wallet for ${data.admin_id}:`,
                error,
            )
            throw error
        }
    }
}
