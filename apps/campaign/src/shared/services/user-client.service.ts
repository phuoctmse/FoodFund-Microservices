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
                        fullName: string
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
                fullName: response.user.fullName,
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
            // Use GetUser method with cognitoId parameter (camelCase per gRPC convention)
            const response = await this.grpcClient.callUserService<
                { id?: string; cognitoId?: string },
                {
                    success: boolean
                    user?: {
                        id: string
                        cognitoId: string
                        fullName: string
                        username: string
                        email: string
                    }
                    error?: string
                }
            >(
                "GetUser",
                { cognitoId: cognitoId },
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
                fullName: response.user.fullName,
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
        fundraiserId: string
        campaignId: string
        paymentTransactionId: string
        amount: bigint
        gateway: string
        description?: string
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Calling CreditFundraiserWallet for fundraiser ${data.fundraiserId}`,
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
                    fundraiserId: data.fundraiserId,
                    campaignId: data.campaignId,
                    paymentTransactionId: data.paymentTransactionId,
                    amount: data.amount.toString(), // Convert bigint to string for gRPC
                    gateway: data.gateway,
                    description: data.description,
                },
                { timeout: 5000, retries: 3 }, // Higher timeout for wallet operations
            )

            this.logger.debug(
                `[gRPC] Response received: success=${response?.success}, walletTransactionId=${response?.walletTransactionId}`,
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
            const errorMsg = error?.message || String(error)
            this.logger.error(
                `[gRPC] ❌ Failed to credit fundraiser wallet for ${data.fundraiserId}: ${errorMsg}`,
            )
            throw error
        }
    }

    /**
     * Credit Admin Wallet for Sepay incoming transfers (catch-all)
     * Calls User service via gRPC to create wallet transaction for Admin
     */
    async creditAdminWallet(data: {
        adminId: string
        campaignId: string | null
        paymentTransactionId: string | null
        amount: bigint
        gateway: string
        description?: string
        sepayMetadata?: {
            sepayId: number
            referenceCode: string
            content: string
            bankName: string
            transactionDate: string
            accumulated: number
            subAccount: string | null
            description: string
        }
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Calling CreditAdminWallet for admin ${data.adminId}`,
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
                    adminId: data.adminId,
                    campaignId: data.campaignId,
                    paymentTransactionId: data.paymentTransactionId,
                    amount: data.amount.toString(), // Convert bigint to string for gRPC
                    gateway: data.gateway,
                    description: data.description,
                    sepayMetadata: data.sepayMetadata
                        ? JSON.stringify(data.sepayMetadata)
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
                `[gRPC] ❌ Failed to credit admin wallet for ${data.adminId}:`,
                error,
            )
            throw error
        }
    }

    /**
     * Get wallet transactions by payment transaction ID
     * Fetches all wallet credit transactions linked to a specific payment
     */
    async getWalletTransactionsByPaymentId(
        paymentTransactionId: string,
    ): Promise<
        Array<{
            id: string
            amount: string
            transactionType: string
            gateway: string | null
            reference: string | null
            description: string | null
            createdAt: Date
        }>
    > {
        try {
            this.logger.log(
                `[gRPC] Fetching wallet transactions for payment ${paymentTransactionId}`,
            )

            const response = await this.grpcClient.callUserService<
                { paymentTransactionId: string },
                {
                    success: boolean
                    transactions?: Array<{
                        id: string
                        amount: string
                        transactionType: string
                        gateway: string | null
                        reference: string | null
                        description: string | null
                        createdAt: string // ISO date string
                    }>
                    error?: string
                }
            >(
                "GetWalletTransactionsByPaymentId",
                { paymentTransactionId },
                { timeout: 3000, retries: 2 },
            )

            if (!response.success || !response.transactions) {
                this.logger.warn(
                    `No wallet transactions found for payment ${paymentTransactionId}`,
                )
                return []
            }

            return response.transactions.map((tx) => ({
                ...tx,
                createdAt: new Date(tx.createdAt),
            }))
        } catch (error) {
            this.logger.error(
                `[gRPC] Failed to fetch wallet transactions for payment ${paymentTransactionId}:`,
                error,
            )
            return [] // Return empty array on error (non-critical)
        }
    }

    /**
     * Process bank transfer OUT (withdrawal from admin wallet)
     * Calls User service via gRPC to process Sepay outgoing transfer
     */
    async processBankTransferOut(data: {
        sepayId: number
        amount: bigint
        gateway: string
        referenceCode: string
        content: string
        transactionDate: string
        description: string
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Calling ProcessBankTransferOut - Sepay ID: ${data.sepayId}, Amount: ${data.amount}`,
            )

            const response = await this.grpcClient.callUserService<
                {
                    sepayId: number
                    amount: string // gRPC uses string for bigint
                    gateway: string
                    referenceCode: string
                    content: string
                    transactionDate: string
                    description: string
                },
                {
                    success: boolean
                    walletTransactionId?: string
                    error?: string
                }
            >(
                "ProcessBankTransferOut",
                {
                    sepayId: data.sepayId,
                    amount: data.amount.toString(),
                    gateway: data.gateway,
                    referenceCode: data.referenceCode,
                    content: data.content,
                    transactionDate: data.transactionDate,
                    description: data.description,
                },
                { timeout: 5000, retries: 3 },
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to process bank transfer out",
                )
            }

            this.logger.log(
                `[gRPC] ✅ Bank transfer OUT processed - Transaction ID: ${response.walletTransactionId}`,
            )
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to process bank transfer OUT (Sepay ID: ${data.sepayId}):`,
                error,
            )
            throw error
        }
    }
}
