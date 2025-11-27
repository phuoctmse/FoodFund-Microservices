import { Injectable, Logger } from "@nestjs/common"
import { GrpcClientService } from "@libs/grpc"

interface UserProfile {
    id: string
    fullName?: string
    username?: string
    email?: string
}

export interface UserDisplayInfo {
    id: string
    fullName: string
    username: string
    avatarUrl: string
}

export interface OrganizationInfo {
    id: string
    name: string
    representativeId: string
    representativeName: string
    activityField?: string
    address?: string
    phoneNumber?: string
    email?: string
}

export interface GetVerifiedOrganizationsResponse {
    success: boolean
    organizations: OrganizationInfo[]
    error?: string
}

export interface GetOrganizationByIdResponse {
    success: boolean
    organization?: {
        id: string
        name: string
        representativeId: string
    }
    error?: string
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


    async getUserNamesByIds(userIds: string[]): Promise<Map<string, string>> {
        const userNameMap = new Map<string, string>()

        if (userIds.length === 0) return userNameMap

        const userPromises = userIds.map((userId) =>
            this.getUserById(userId).catch((error) => {
                this.logger.warn(`Failed to fetch user ${userId}:`, error)
                return null
            }),
        )

        const users = await Promise.all(userPromises)

        users.forEach((user, index) => {
            if (user) {
                const userName =
                    user.fullName || user.username || "Unknown Donor"
                userNameMap.set(userIds[index], userName)
            }
        })

        return userNameMap
    }

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
                    amount: string 
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
                    amount: data.amount.toString(), 
                    gateway: data.gateway,
                    description: data.description,
                },
                { timeout: 5000, retries: 3 }, 
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
                    amount: string
                    gateway: string
                    description?: string
                    sepayMetadata?: string
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
                    amount: data.amount.toString(), 
                    gateway: data.gateway,
                    description: data.description,
                    sepayMetadata: data.sepayMetadata
                        ? JSON.stringify(data.sepayMetadata)
                        : undefined, 
                },
                { timeout: 5000, retries: 3 }, 
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
                        createdAt: string 
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
            return [] 
        }
    }

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
                    amount: string
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

    async updateDonorStats(data: {
        donorId: string
        amountToAdd: bigint
        incrementCount: number
        lastDonationAt: Date
    }): Promise<void> {
        try {
            this.logger.log(
                `[gRPC] Updating donor stats for ${data.donorId} - Amount: ${data.amountToAdd}, Count: ${data.incrementCount}`,
            )

            const response = await this.grpcClient.callUserService<
                {
                    donorId: string
                    amountToAdd: string 
                    incrementCount: number
                    lastDonationAt: string 
                },
                {
                    success: boolean
                    totalDonated?: string
                    donationCount?: number
                    error?: string
                }
            >(
                "UpdateDonorStats",
                {
                    donorId: data.donorId,
                    amountToAdd: data.amountToAdd.toString(),
                    incrementCount: data.incrementCount,
                    lastDonationAt: data.lastDonationAt.toISOString(),
                },
                { timeout: 3000, retries: 2 },
            )

            if (!response.success) {
                throw new Error(
                    response.error || "Failed to update donor stats",
                )
            }

            this.logger.log(
                `[gRPC] ✅ Donor stats updated - Total: ${response.totalDonated}, Count: ${response.donationCount}`,
            )
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to update donor stats for ${data.donorId}:`,
                error,
            )
        }
    }

    async getFundraiserWalletBalance(userId: string): Promise<bigint> {
        try {
            this.logger.log(
                `[gRPC] Getting wallet balance for fundraiser ${userId}`,
            )

            const response = await this.grpcClient.callUserService<
                { userId: string },
                {
                    success: boolean
                    balance?: string
                    error?: string
                }
            >(
                "GetFundraiserWalletBalance",
                { userId },
                { timeout: 3000, retries: 2 },
            )

            if (!response.success || !response.balance) {
                throw new Error(
                    response.error || "Failed to get wallet balance",
                )
            }

            return BigInt(response.balance)
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to get wallet balance for ${userId}:`,
                error,
            )
            return BigInt(0) 
        }
    }

    async debitFundraiserWallet(data: {
        userId: string
        campaignId: string
        amount: bigint
        description?: string
    }): Promise<{ success: boolean; newBalance: bigint }> {
        try {
            this.logger.log(
                `[gRPC] Debiting ${data.amount} from fundraiser ${data.userId} for campaign ${data.campaignId}`,
            )

            const response = await this.grpcClient.callUserService<
                {
                    userId: string
                    campaignId: string
                    amount: string
                    description?: string
                },
                {
                    success: boolean
                    walletTransactionId?: string
                    newBalance?: string
                    error?: string
                }
            >(
                "DebitFundraiserWallet",
                {
                    userId: data.userId,
                    campaignId: data.campaignId,
                    amount: data.amount.toString(),
                    description: data.description,
                },
                { timeout: 5000, retries: 3 },
            )

            if (!response.success) {
                throw new Error(response.error || "Failed to debit wallet")
            }

            this.logger.log(
                `[gRPC] ✅ Wallet debited - Transaction: ${response.walletTransactionId}, New balance: ${response.newBalance}`,
            )

            return {
                success: true,
                newBalance: BigInt(response.newBalance || "0"),
            }
        } catch (error) {
            this.logger.error(
                `[gRPC] ❌ Failed to debit wallet for ${data.userId}:`,
                error,
            )
            throw error
        }
    }
    async getUserDisplayName(userId: string): Promise<string> {
        const response = await this.grpcClient.callUserService<
            { userId: string },
            { success: boolean; displayName: string; error?: string }
        >("getUserDisplayName", { userId }, { timeout: 3000, retries: 2 })

        if (!response.success) {
            return "Unknown User"
        }

        return response.displayName
    }

    async getUsersByIds(userIds: string[]): Promise<UserDisplayInfo[]> {
        if (!userIds || userIds.length === 0) {
            return []
        }

        const response = await this.grpcClient.callUserService<
            { userIds: string[] },
            {
                success: boolean
                users: UserDisplayInfo[]
                error?: string
            }
        >("getUsersByIds", { userIds }, { timeout: 5000, retries: 2 })

        if (!response.success) {
            return []
        }

        return response.users
    }

    async getUserBasicInfo(userId: string): Promise<{
        success: boolean
        user?: {
            id: string
            role: string
            organizationId: string | null
            organizationName: string | null
        }
        error?: string
    }> {
        return this.grpcClient.callUserService<
            { userId: string },
            {
                success: boolean
                user?: {
                    id: string
                    role: string
                    organizationId: string | null
                    organizationName: string | null
                }
                error?: string
            }
        >("GetUserBasicInfo", { userId })
    }

    async getVerifiedOrganizations(): Promise<GetVerifiedOrganizationsResponse> {
        try {
            const response = await this.grpcClient.callUserService<
                Record<string, never>,
                {
                    success: boolean
                    organizations?: Array<{
                        id: string
                        name: string
                        representativeId: string
                        representativeName: string
                        activityField: string
                        address: string
                        phoneNumber: string
                        email: string
                    }>
                    error?: string
                }
            >("GetVerifiedOrganizations", {}, { timeout: 5000, retries: 2 })

            if (!response.success) {
                this.logger.warn(
                    `[gRPC] GetVerifiedOrganizations failed: ${response.error}`,
                )
                return {
                    success: false,
                    organizations: [],
                    error: response.error,
                }
            }

            return {
                success: true,
                organizations: response.organizations || [],
            }
        } catch (error) {
            this.logger.error(
                "[gRPC] Error calling GetVerifiedOrganizations:",
                error,
            )
            return {
                success: false,
                organizations: [],
                error: error.message,
            }
        }
    }

    async getOrganizationById(
        organizationId: string,
    ): Promise<GetOrganizationByIdResponse> {
        try {
            const response = await this.grpcClient.callUserService<
                { organizationId: string },
                {
                    success: boolean
                    organization?: {
                        id: string
                        name: string
                        representativeId: string
                    }
                    error?: string
                }
            >(
                "GetOrganizationById",
                { organizationId },
                { timeout: 3000, retries: 2 },
            )

            if (!response.success) {
                this.logger.warn(
                    `[gRPC] GetOrganizationById failed: ${response.error}`,
                )
                return {
                    success: false,
                    error: response.error,
                }
            }

            return {
                success: true,
                organization: response.organization,
            }
        } catch (error) {
            this.logger.error(
                `[gRPC] Error calling GetOrganizationById for ${organizationId}:`,
                error,
            )
            return {
                success: false,
                error: error.message,
            }
        }
    }
}
