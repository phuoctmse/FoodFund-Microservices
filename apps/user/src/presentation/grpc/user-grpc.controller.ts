import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import {
    UserRepository,
    WalletRepository,
    OrganizationRepository,
    UserBadgeRepository,
} from "../../application/repositories"
import { UserBadgeService } from "../../application/services/badge"
import { Role } from "@libs/databases"
import { generateUniqueUsername } from "libs/common"
import { Transaction_Type, Wallet_Type } from "../../domain/enums/wallet.enum"
import { WalletTransactionService } from "../../application/services"
import { GrpcClientService } from "@libs/grpc"

import {
    CreateUserRequest,
    CreateUserResponse,
    GetUserRequest,
    GetUserResponse,
    UpdateUserRequest,
    UpdateUserResponse,
    UserExistsRequest,
    UserExistsResponse,
    GetUserByEmailRequest,
    GetUserByEmailResponse,
    HealthResponse,
    CreditAdminWalletRequest,
    CreditFundraiserWalletRequest,
    CreditWalletResponse,
    ProcessBankTransferOutRequest,
    ProcessBankTransferOutResponse,
    AwardBadgeRequest,
    AwardBadgeResponse,
    GetUserBadgeRequest,
    GetUserBadgeResponse,
    UpdateDonorStatsRequest,
    UpdateDonorStatsResponse,
    GetUserWithStatsRequest,
    GetUserWithStatsResponse,
    GetWalletBalanceRequest,
    GetWalletBalanceResponse,
    DebitWalletRequest,
    DebitWalletResponse,
    GetUserBasicInfoRequest,
    GetUserBasicInfoResponse,
    GetUserOrganizationRequest,
    GetUserOrganizationResponse,
    GetUsersByIdsRequest,
    GetUsersByIdsResponse,
    GetUserDisplayNameRequest,
    GetUserDisplayNameResponse,
    GetWalletTransactionsByPaymentIdRequest,
    GetWalletTransactionsByPaymentIdResponse,
    GetOrganizationByIdRequest,
    GetOrganizationByIdResponse,
    GetVerifiedOrganizationsRequest,
    GetVerifiedOrganizationsResponse,
    CreditFundraiserWalletWithSurplusRequest,
    CreditFundraiserWalletWithSurplusResponse,
} from "../../application/dtos/user-grpc.dto"

const ROLE_MAP = {
    DONOR: 0,
    FUNDRAISER: 1,
    KITCHEN_STAFF: 2,
    DELIVERY_STAFF: 3,
    ADMIN: 4,
}

@Controller()
export class UserGrpcController {
    private readonly logger = new Logger(UserGrpcController.name)

    constructor(
        private readonly userRepository: UserRepository,
        private readonly walletRepository: WalletRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly walletTransactionService: WalletTransactionService,
        private readonly userBadgeService: UserBadgeService,
        private readonly userBadgeRepository: UserBadgeRepository,
        private readonly grpcClientService: GrpcClientService,
    ) { }

    /**
     * Helper: Map user entity to gRPC response format
     */
    private mapUserToResponse(user: any): any {
        return {
            id: user.id,
            cognitoId: user.cognito_id,
            email: user.email,
            username: user.user_name,
            fullName: user.full_name,
            phoneNumber: user.phone_number || "",
            avatarUrl: user.avatar_url || "",
            bio: user.bio || "",
            role: ROLE_MAP[user.role] || 0,
            isActive: user.is_active,
            createdAt: user.created_at.toISOString(),
            updatedAt: user.updated_at.toISOString(),
        }
    }

    /**
     * Helper: Create success response
     */
    private createSuccessResponse(
        user: any,
    ):
        | GetUserResponse
        | CreateUserResponse
        | UpdateUserResponse
        | GetUserByEmailResponse {
        return {
            success: true,
            user: this.mapUserToResponse(user),
            error: null,
        }
    }

    /**
     * Helper: Create error response
     */
    private createErrorResponse(
        error: string,
    ):
        | GetUserResponse
        | CreateUserResponse
        | UpdateUserResponse
        | GetUserByEmailResponse {
        return {
            success: false,
            user: null,
            error,
        }
    }

    /**
     * Helper: Execute wallet operation with error handling
     */
    private async executeWalletOperation<T>(
        operationName: string,
        operation: () => Promise<T>,
    ): Promise<{
        success: boolean
        walletTransactionId?: string
        error?: string
    }> {
        try {
            const result = await operation()
            return {
                success: true,
                walletTransactionId: (result as any)?.id,
            }
        } catch (error) {
            const errorMessage =
                error?.message || error?.toString() || "Unknown error"
            this.logger.error(
                `[${operationName}] ❌ Failed:`,
                error?.stack || errorMessage,
            )
            return {
                success: false,
                error: errorMessage,
            }
        }
    }

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
        try {
            const { cognitoId, email, fullName, cognitoAttributes } = data

            if (!cognitoId || !email) {
                return this.createErrorResponse(
                    "Cognito ID and email are required",
                )
            }

            const finalUsername = generateUniqueUsername(email)

            const user = await this.userRepository.createUser({
                cognito_id: cognitoId,
                email,
                user_name: finalUsername,
                full_name: fullName || "",
                avatar_url: cognitoAttributes?.avatarUrl || "",
                bio: cognitoAttributes?.bio || "",
                role: Role.DONOR,
            } as any)

            if (!user) {
                return this.createErrorResponse("Failed to create user")
            }

            return this.createSuccessResponse(user)
        } catch (error) {
            return this.createErrorResponse(error.message)
        }
    }

    @GrpcMethod("UserService", "GetUser")
    async getUser(data: GetUserRequest): Promise<GetUserResponse> {
        try {
            const { cognitoId } = data

            if (!cognitoId) {
                return this.createErrorResponse("Cognito ID is required")
            }

            const user =
                await this.userRepository.findUserByCognitoId(cognitoId)

            if (!user) {
                return this.createErrorResponse("User not found")
            }

            return this.createSuccessResponse(user)
        } catch (error) {
            return this.createErrorResponse(error.message)
        }
    }

    @GrpcMethod("UserService", "UpdateUser")
    async updateUser(data: UpdateUserRequest): Promise<UpdateUserResponse> {
        try {
            const { id, fullName, phoneNumber, avatarUrl, bio } = data

            if (!id) {
                return this.createErrorResponse("User ID is required")
            }

            const updateData: any = {}
            if (fullName) updateData.full_name = fullName
            if (phoneNumber) updateData.phone_number = phoneNumber
            if (avatarUrl) updateData.avatar_url = avatarUrl
            if (bio) updateData.bio = bio

            const user = await this.userRepository.updateUser(id, updateData)

            return this.createSuccessResponse(user)
        } catch (error) {
            return this.createErrorResponse(error.message)
        }
    }

    @GrpcMethod("UserService", "UserExists")
    async userExists(data: UserExistsRequest): Promise<UserExistsResponse> {
        try {
            const { cognitoId } = data

            if (!cognitoId) {
                return {
                    exists: false,
                    userId: "",
                    error: null,
                }
            }

            const user =
                await this.userRepository.findUserByCognitoId(cognitoId)

            return {
                exists: !!user,
                userId: user?.id || "",
                error: null,
            }
        } catch (error) {
            return {
                exists: false,
                userId: "",
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "GetUserByEmail")
    async getUserByEmail(
        data: GetUserByEmailRequest,
    ): Promise<GetUserByEmailResponse> {
        try {
            const { email } = data

            if (!email) {
                return this.createErrorResponse("Email is required")
            }

            const user = await this.userRepository.findUserByEmail(email)

            if (!user) {
                return this.createErrorResponse("User not found")
            }

            return this.createSuccessResponse(user)
        } catch (error) {
            return this.createErrorResponse(error.message)
        }
    }

    @GrpcMethod("UserService", "CreditFundraiserWallet")
    async creditFundraiserWallet(
        data: CreditFundraiserWalletRequest,
    ): Promise<CreditWalletResponse> {
        const {
            fundraiserId,
            campaignId,
            paymentTransactionId,
            amount,
            gateway,
            description,
        } = data

        this.logger.log(
            `[CreditFundraiserWallet] Processing for fundraiser ${fundraiserId}, campaign ${campaignId || "SYSTEM"}, amount ${amount}`,
        )

        if (!fundraiserId) {
            return {
                success: false,
                error: "fundraiserId is required",
            }
        }

        return this.executeWalletOperation(
            "CreditFundraiserWallet",
            async () => {
                const user =
                    await this.userRepository.findUserById(fundraiserId)
                if (!user) {
                    this.logger.error(
                        `[CreditFundraiserWallet] ❌ Fundraiser ${fundraiserId} not found`,
                    )
                    throw new Error(`Fundraiser ${fundraiserId} not found`)
                }

                const transactionType =
                    gateway === "SYSTEM"
                        ? Transaction_Type.ADMIN_ADJUSTMENT
                        : Transaction_Type.INCOMING_TRANSFER

                // Credit wallet
                const transaction = await this.walletRepository.creditWallet({
                    userId: fundraiserId,
                    walletType: Wallet_Type.FUNDRAISER,
                    amount: BigInt(amount),
                    transactionType,
                    campaignId: campaignId || null,
                    paymentTransactionId: paymentTransactionId || null,
                    gateway,
                    description: description || `Wallet credit via ${gateway}`,
                })

                this.logger.log(
                    `[CreditFundraiserWallet] ✅ Success - Transaction ID: ${transaction.id}`,
                )

                return transaction
            },
        )
    }

    @GrpcMethod("UserService", "CreditAdminWallet")
    async creditAdminWallet(
        data: CreditAdminWalletRequest,
    ): Promise<CreditWalletResponse> {
        const {
            adminId,
            campaignId,
            paymentTransactionId,
            amount,
            gateway,
            description,
            sepayMetadata,
        } = data

        this.logger.log(
            `[CreditAdminWallet] Processing for admin ${adminId}, campaign ${campaignId || "UNKNOWN"}, amount ${amount}`,
        )

        if (!adminId) {
            return {
                success: false,
                error: "adminId is required",
            }
        }

        return this.executeWalletOperation("CreditAdminWallet", async () => {
            // Verify admin user exists
            const user = await this.userRepository.findUserById(adminId)
            if (!user) {
                throw new Error(`Admin ${adminId} not found`)
            }

            // Parse sepay metadata if provided
            let parsedSepayMetadata = null
            if (sepayMetadata) {
                try {
                    parsedSepayMetadata = JSON.parse(sepayMetadata)
                } catch (e) {
                    this.logger.warn(
                        "[CreditAdminWallet] Failed to parse sepayMetadata, storing as null",
                    )
                }
            }

            // Credit wallet
            const transaction = await this.walletRepository.creditWallet({
                userId: adminId,
                walletType: Wallet_Type.ADMIN,
                amount: BigInt(amount),
                transactionType: Transaction_Type.INCOMING_TRANSFER,
                campaignId: campaignId || null,
                paymentTransactionId: paymentTransactionId || null,
                gateway,
                description: description || `Incoming transfer via ${gateway}`,
                sepayMetadata: parsedSepayMetadata,
            })

            this.logger.log(
                `[CreditAdminWallet] ✅ Success - Transaction ID: ${transaction.id}`,
            )

            return transaction
        })
    }

    @GrpcMethod("UserService", "GetUserBasicInfo")
    async getUserBasicInfo(
        data: GetUserBasicInfoRequest,
    ): Promise<GetUserBasicInfoResponse> {
        const { userId } = data

        if (!userId) {
            return {
                success: false,
                error: "User ID is required",
            }
        }

        const user = await this.userRepository.findUserBasicInfo(userId)

        if (!user) {
            return {
                success: false,
                error: `User ${userId} not found`,
            }
        }

        let organizationId: string | null = null
        let organizationName: string | null = null

        if (user.role === Role.FUNDRAISER) {
            const organization =
                await this.organizationRepository.findOrganizationBasicInfoByRepresentativeId(
                    user.id,
                )
            if (organization) {
                organizationId = organization.id
                organizationName = organization.name
            }
        } else if (
            user.role === Role.KITCHEN_STAFF ||
            user.role === Role.DELIVERY_STAFF
        ) {
            const memberRecord =
                await this.organizationRepository.findMemberOrganizationBasicInfo(
                    user.id,
                )
            if (memberRecord?.organization) {
                organizationId = memberRecord.organization.id
                organizationName = memberRecord.organization.name
            }
        }

        return {
            success: true,
            user: {
                id: user.id,
                role: user.role,
                organizationId,
                organizationName,
            },
        }
    }

    @GrpcMethod("UserService", "GetUserOrganization")
    async getUserOrganization(
        data: GetUserOrganizationRequest,
    ): Promise<GetUserOrganizationResponse> {
        const { userId } = data

        if (!userId) {
            return {
                success: false,
                error: "User ID is required",
            }
        }

        const user = await this.userRepository.findUserBasicInfo(userId)

        if (!user) {
            return {
                success: false,
                error: `User ${userId} not found`,
            }
        }

        if (user.role === Role.FUNDRAISER) {
            const organization =
                await this.organizationRepository.findOrganizationBasicInfoByRepresentativeId(
                    user.id,
                )

            if (!organization) {
                return {
                    success: false,
                    error: "Fundraiser does not have an organization",
                }
            }

            return {
                success: true,
                organization: {
                    id: organization.id,
                    name: organization.name,
                },
            }
        }

        if (
            user.role === Role.KITCHEN_STAFF ||
            user.role === Role.DELIVERY_STAFF
        ) {
            const memberRecord =
                await this.organizationRepository.findMemberOrganizationBasicInfo(
                    user.id,
                )

            if (!memberRecord?.organization) {
                return {
                    success: false,
                    error: "User is not a member of any organization",
                }
            }

            return {
                success: true,
                organization: {
                    id: memberRecord.organization.id,
                    name: memberRecord.organization.name,
                },
            }
        }

        return {
            success: false,
            error: `User role ${user.role} does not have organization`,
        }
    }

    @GrpcMethod("UserService", "GetWalletTransactionsByPaymentId")
    async getWalletTransactionsByPaymentId(
        data: GetWalletTransactionsByPaymentIdRequest,
    ): Promise<GetWalletTransactionsByPaymentIdResponse> {
        try {
            const { paymentTransactionId } = data

            this.logger.log(
                `[GetWalletTransactionsByPaymentId] Fetching transactions for payment ${paymentTransactionId}`,
            )

            // Query wallet transactions by payment_transaction_id
            const transactions =
                await this.walletRepository.findByPaymentTransactionId(
                    paymentTransactionId,
                )

            if (!transactions || transactions.length === 0) {
                this.logger.warn(
                    `[GetWalletTransactionsByPaymentId] No transactions found for payment ${paymentTransactionId}`,
                )
                return {
                    success: true,
                    transactions: [],
                }
            }

            // Map to response format
            const mappedTransactions = transactions.map((tx) => ({
                id: tx.id,
                amount: tx.amount.toString(),
                transactionType: tx.transaction_type,
                gateway: tx.gateway || null,
                reference: null as string | null, // Not available in schema
                description: tx.description || null,
                createdAt: tx.created_at.toISOString(),
            }))

            this.logger.log(
                `[GetWalletTransactionsByPaymentId] Found ${transactions.length} transactions`,
            )

            return {
                success: true,
                transactions: mappedTransactions,
            }
        } catch (error) {
            this.logger.error(
                "[GetWalletTransactionsByPaymentId] Failed:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "ProcessBankTransferOut")
    async processBankTransferOut(
        data: ProcessBankTransferOutRequest,
    ): Promise<ProcessBankTransferOutResponse> {
        const {
            sepayId,
            amount,
            gateway,
            referenceCode,
            content,
            transactionDate,
            description,
        } = data

        this.logger.log(
            `[ProcessBankTransferOut] Processing withdrawal - Sepay ID: ${sepayId}, Amount: ${amount}`,
        )

        if (!sepayId || !amount) {
            return {
                success: false,
                error: "sepayId and amount are required",
            }
        }

        return this.executeWalletOperation(
            "ProcessBankTransferOut",
            async () => {
                // Build Sepay webhook payload
                const payload = {
                    id: sepayId,
                    gateway,
                    transactionDate,
                    accountNumber: "", // Not needed for withdrawal
                    code: null,
                    content,
                    transferType: "out",
                    transferAmount: Number(amount),
                    accumulated: 0, // Not needed
                    subAccount: null,
                    referenceCode,
                    description,
                }

                // Process bank transfer out
                await this.walletTransactionService.processBankTransferOut(
                    payload,
                )

                this.logger.log(
                    `[ProcessBankTransferOut] ✅ Successfully processed withdrawal - Sepay ID: ${sepayId}`,
                )

                return { id: sepayId.toString() }
            },
        )
    }

    @GrpcMethod("UserService", "GetUsersByIds")
    async getUsersByIds(
        data: GetUsersByIdsRequest,
    ): Promise<GetUsersByIdsResponse> {
        try {
            const { userIds } = data

            if (!userIds || userIds.length === 0) {
                return {
                    success: true,
                    users: [],
                }
            }

            const users = await this.userRepository.findUsersByIds(userIds)

            const mappedUsers = users.map((user) => ({
                id: user.id,
                fullName: user.full_name || "",
                username: user.user_name,
                avatarUrl: user.avatar_url || "",
            }))

            return {
                success: true,
                users: mappedUsers,
            }
        } catch (error) {
            this.logger.error("[GetUsersByIds] Failed:", error)
            return {
                success: false,
                users: [],
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "GetUserDisplayName")
    async getUserDisplayName(
        data: GetUserDisplayNameRequest,
    ): Promise<GetUserDisplayNameResponse> {
        const { userId } = data

        if (!userId) {
            return {
                success: false,
                displayName: "Unknown User",
                error: "User ID is required",
            }
        }

        const user = await this.userRepository.findUserFullName(userId)

        if (!user) {
            return {
                success: false,
                displayName: "Unknown User",
                error: "User not found",
            }
        }

        const displayName = user.full_name || "Anonymous"

        return {
            success: true,
            displayName,
        }
    }

    @GrpcMethod("UserService", "AwardBadgeToDonor")
    async awardBadgeToDonor(
        data: AwardBadgeRequest,
    ): Promise<AwardBadgeResponse> {
        const { userId, badgeId } = data

        this.logger.log(
            `[AwardBadgeToDonor] Awarding badge ${badgeId} to user ${userId}`,
        )

        if (!userId || !badgeId) {
            return {
                success: false,
                error: "userId and badgeId are required",
            }
        }

        try {
            const userBadge = await this.userBadgeService.awardBadge(
                userId,
                badgeId,
            )

            this.logger.log(
                `[AwardBadgeToDonor] ✅ Successfully awarded badge ${badgeId} to user ${userId}`,
            )

            return {
                success: true,
                userBadgeId: userBadge.id,
                badge: {
                    id: userBadge.badge.id,
                    name: userBadge.badge.name,
                    description: userBadge.badge.description,
                    iconUrl: userBadge.badge.icon_url,
                    sortOrder: userBadge.badge.sort_order,
                    isActive: userBadge.badge.is_active,
                    createdAt: userBadge.badge.created_at.toISOString(),
                    updatedAt: userBadge.badge.updated_at.toISOString(),
                },
            }
        } catch (error) {
            this.logger.error(
                "[AwardBadgeToDonor] ❌ Failed to award badge:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to award badge",
            }
        }
    }

    @GrpcMethod("UserService", "GetUserBadge")
    async getUserBadge(
        data: GetUserBadgeRequest,
    ): Promise<GetUserBadgeResponse> {
        const { userId } = data

        this.logger.log(`[GetUserBadge] Fetching badge for user ${userId}`)

        if (!userId) {
            return {
                success: false,
                error: "userId is required",
            }
        }

        try {
            const userBadge =
                await this.userBadgeRepository.findUserBadge(userId)

            if (!userBadge) {
                this.logger.log(`[GetUserBadge] User ${userId} has no badge`)
                return {
                    success: true,
                    badge: undefined,
                    awardedAt: undefined,
                }
            }

            this.logger.log(
                `[GetUserBadge] ✅ Found badge ${userBadge.badge.name} for user ${userId}`,
            )

            return {
                success: true,
                badge: {
                    id: userBadge.badge.id,
                    name: userBadge.badge.name,
                    description: userBadge.badge.description,
                    iconUrl: userBadge.badge.icon_url,
                    sortOrder: userBadge.badge.sort_order,
                    isActive: userBadge.badge.is_active,
                    createdAt: userBadge.badge.created_at.toISOString(),
                    updatedAt: userBadge.badge.updated_at.toISOString(),
                },
                awardedAt: userBadge.awarded_at.toISOString(),
            }
        } catch (error) {
            this.logger.error(
                "[GetUserBadge] ❌ Failed to fetch badge:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to fetch badge",
            }
        }
    }

    @GrpcMethod("UserService", "UpdateDonorStats")
    async updateDonorStats(
        data: UpdateDonorStatsRequest,
    ): Promise<UpdateDonorStatsResponse> {
        const { donorId, amountToAdd, incrementCount, lastDonationAt } = data

        this.logger.log(
            `[UpdateDonorStats] Updating stats for donor ${donorId} - Amount: ${amountToAdd}, Count: ${incrementCount}`,
        )

        if (!donorId || !amountToAdd) {
            return {
                success: false,
                error: "donorId and amountToAdd are required",
            }
        }

        try {
            const updatedUser = await this.userRepository.updateDonorStats({
                donorId,
                amountToAdd: BigInt(amountToAdd),
                incrementCount: incrementCount || 1,
                lastDonationAt: new Date(lastDonationAt),
            })

            this.logger.log(
                `[UpdateDonorStats] ✅ Updated donor ${donorId} - Total: ${updatedUser.total_donated}, Count: ${updatedUser.donation_count}`,
            )

            return {
                success: true,
                totalDonated: (
                    updatedUser.total_donated || BigInt(0)
                ).toString(),
                donationCount: updatedUser.donation_count || 0,
            }
        } catch (error) {
            this.logger.error(
                "[UpdateDonorStats] ❌ Failed to update stats:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to update donor stats",
            }
        }
    }

    @GrpcMethod("UserService", "GetUserWithStats")
    async getUserWithStats(
        data: GetUserWithStatsRequest,
    ): Promise<GetUserWithStatsResponse> {
        const { id } = data

        this.logger.log(`[GetUserWithStats] Fetching stats for user ${id}`)

        if (!id) {
            return {
                success: false,
                error: "id is required",
            }
        }

        try {
            const user = await this.userRepository.findUserById(id)

            if (!user) {
                this.logger.warn(`[GetUserWithStats] User not found: ${id}`)
                return {
                    success: false,
                    error: "User not found",
                }
            }

            this.logger.log(
                `[GetUserWithStats] ✅ Found user ${id} - Total: ${user.total_donated}, Count: ${user.donation_count}`,
            )

            return {
                success: true,
                id: user.id,
                totalDonated: (user.total_donated || BigInt(0)).toString(),
                donationCount: user.donation_count || 0,
                lastDonationAt: user.last_donation_at?.toISOString() || "",
            }
        } catch (error) {
            this.logger.error(
                "[GetUserWithStats] ❌ Failed to fetch stats:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to fetch user stats",
            }
        }
    }

    @GrpcMethod("UserService", "GetFundraiserWalletBalance")
    async getFundraiserWalletBalance(
        data: GetWalletBalanceRequest,
    ): Promise<GetWalletBalanceResponse> {
        const { userId } = data

        this.logger.log(
            `[GetFundraiserWalletBalance] Fetching balance for user ${userId}`,
        )

        if (!userId) {
            return {
                success: false,
                error: "userId is required",
            }
        }

        try {
            const balance = await this.walletRepository.getWalletBalance(
                userId,
                Wallet_Type.FUNDRAISER,
            )

            this.logger.log(
                `[GetFundraiserWalletBalance] ✅ Balance: ${balance}`,
            )

            return {
                success: true,
                balance: balance.toString(),
            }
        } catch (error) {
            this.logger.error(
                "[GetFundraiserWalletBalance] ❌ Failed:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to fetch wallet balance",
            }
        }
    }

    @GrpcMethod("UserService", "DebitFundraiserWallet")
    async debitFundraiserWallet(
        data: DebitWalletRequest,
    ): Promise<DebitWalletResponse> {
        const { userId, campaignId, amount, description } = data

        this.logger.log(
            `[DebitFundraiserWallet] Debiting ${amount} from user ${userId} for campaign ${campaignId}`,
        )

        if (!userId || !campaignId || !amount) {
            return {
                success: false,
                error: "userId, campaignId, and amount are required",
            }
        }

        try {
            const transaction = await this.walletRepository.debitWallet({
                userId,
                walletType: Wallet_Type.FUNDRAISER,
                amount: BigInt(amount),
                transactionType: Transaction_Type.WITHDRAWAL,
                campaignId,
                description:
                    description ||
                    `Auto-transfer to campaign ${campaignId} on approval`,
            })

            // Get new balance
            const newBalance = await this.walletRepository.getWalletBalance(
                userId,
                Wallet_Type.FUNDRAISER,
            )

            // Update campaign received amount
            try {
                await this.grpcClientService.callCampaignService(
                    "UpdateCampaignReceivedAmount",
                    {
                        campaignId,
                        amount: amount.toString(),
                    },
                )
                this.logger.log(
                    `[DebitFundraiserWallet] ✅ Updated campaign ${campaignId} received amount by ${amount}`,
                )
            } catch (error) {
                this.logger.error(
                    `[DebitFundraiserWallet] ❌ Failed to update campaign ${campaignId}: ${error.message}`,
                )
                // Don't fail the transaction if campaign update fails, but log it
            }

            this.logger.log(
                `[DebitFundraiserWallet] ✅ Debited ${amount}, New balance: ${newBalance}`,
            )

            return {
                success: true,
                walletTransactionId: transaction.id,
                newBalance: newBalance.toString(),
            }
        } catch (error) {
            this.logger.error(
                "[DebitFundraiserWallet] ❌ Failed:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message || "Failed to debit wallet",
            }
        }
    }

    @GrpcMethod("UserService", "GetVerifiedOrganizations")
    async getVerifiedOrganizations(
        data: GetVerifiedOrganizationsRequest,
    ): Promise<GetVerifiedOrganizationsResponse> {
        try {
            const organizations =
                await this.organizationRepository.findAllOrganizations({
                    status: "VERIFIED",
                })

            return {
                success: true,
                organizations: organizations.map((org) => ({
                    id: org.id,
                    name: org.name,
                    representativeId: org.representative_id,
                    representativeName: org.user?.full_name || "",
                    activityField: org.activity_field || "",
                    address: org.address || "",
                    phoneNumber: org.phone_number || "",
                    email: org.email || "",
                })) as any,
            }
        } catch (error) {
            this.logger.error("[GetVerifiedOrganizations] Failed:", error)
            return {
                success: false,
                organizations: [],
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "GetOrganizationById")
    async getOrganizationById(
        data: GetOrganizationByIdRequest,
    ): Promise<GetOrganizationByIdResponse> {
        const { organizationId } = data

        if (!organizationId) {
            return {
                success: false,
                error: "Organization ID is required",
            }
        }

        try {
            const organization =
                await this.organizationRepository.findOrganizationById(
                    organizationId,
                )

            if (!organization) {
                return {
                    success: false,
                    error: `Organization ${organizationId} not found`,
                }
            }

            return {
                success: true,
                organization: {
                    id: organization.id,
                    name: organization.name,
                    representativeId: organization.representative_id,
                },
            }
        } catch (error) {
            this.logger.error(
                `[GetOrganizationById] Failed for ${organizationId}:`,
                error,
            )
            return {
                success: false,
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "CreditFundraiserWalletWithSurplus")
    async creditFundraiserWalletWithSurplus(
        data: CreditFundraiserWalletWithSurplusRequest,
    ): Promise<CreditFundraiserWalletWithSurplusResponse> {
        const {
            fundraiserId,
            campaignId,
            requestId,
            requestType,
            surplusAmount,
            originalBudget,
            actualCost,
            campaignTitle,
            phaseName,
        } = data

        if (!fundraiserId) {
            return {
                success: false,
                error: "fundraiserId is required",
            }
        }

        if (!surplusAmount || BigInt(surplusAmount) <= BigInt(0)) {
            return {
                success: false,
                error: "surplusAmount must be a positive value",
            }
        }

        try {
            const user = await this.userRepository.findUserByCognitoIdSimple(fundraiserId)
            if (!user) {
                return {
                    success: false,
                    error: `Fundraiser with ID ${fundraiserId} not found`,
                }
            }

            const existingWallet = await this.walletRepository.findWalletByUserIdAndType(
                user.id,
                Wallet_Type.FUNDRAISER,
            )

            if (!existingWallet) {
                return {
                    success: false,
                    error: `Fundraiser ${fundraiserId} does not have a wallet. Please create wallet first.`,
                }
            }

            const requestTypeLabel = {
                INGREDIENT: "nguyên liệu",
                COOKING: "nấu ăn",
                DELIVERY: "giao hàng",
            }[requestType] || requestType

            const description =
                `Tiền dư từ yêu cầu ${requestTypeLabel}: ${campaignTitle} - ${phaseName}. ` +
                `Ngân sách: ${BigInt(originalBudget).toLocaleString("vi-VN")} VND, ` +
                `Chi phí thực tế: ${BigInt(actualCost).toLocaleString("vi-VN")} VND. ` +
                `Request ID: ${requestId}`

            const transaction = await this.walletRepository.creditWallet({
                userId: user.id,
                walletType: Wallet_Type.FUNDRAISER,
                amount: BigInt(surplusAmount),
                transactionType: Transaction_Type.INCOMING_TRANSFER,
                campaignId: campaignId || null,
                paymentTransactionId: null,
                gateway: "SURPLUS_TRANSFER",
                description,
            })

            const newBalance = await this.walletRepository.getWalletBalance(
                user.id,
                Wallet_Type.FUNDRAISER,
            )

            return {
                success: true,
                walletTransactionId: transaction.id,
                newBalance: newBalance.toString(),
            }
        } catch (error) {
            const errorMessage = error?.message || error?.toString() || "Unknown error"
            this.logger.error(
                "[CreditFundraiserWalletWithSurplus] ❌ Failed:",
                error?.stack || errorMessage,
            )
            return {
                success: false,
                error: errorMessage,
            }
        }
    }
}
