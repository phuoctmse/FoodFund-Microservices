import { Controller, Logger } from "@nestjs/common"
import { GrpcMethod } from "@nestjs/microservices"
import {
    UserCommonRepository,
    UserAdminRepository,
    WalletRepository,
    OrganizationRepository,
} from "../../domain/repositories"
import { Role } from "@libs/databases"
import { generateUniqueUsername } from "libs/common"
import { Wallet_Type, Transaction_Type } from "../../generated/user-client"

interface CreateUserRequest {
    cognitoId: string
    email: string
    username?: string
    fullName: string
    role?: string
    cognitoAttributes?: {
        avatarUrl?: string
        bio?: string
    }
}

interface CreateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface GetUserRequest {
    cognitoId: string
}

interface GetUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface UpdateUserRequest {
    id: string
    fullName?: string
    avatarUrl?: string
    phoneNumber?: string
    address?: string
    bio?: string
}

interface UpdateUserResponse {
    success: boolean
    user: any | null
    error: string | null
}

interface UserExistsRequest {
    cognitoId: string
}

interface UserExistsResponse {
    exists: boolean
    userId?: string
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

interface CreditAdminWalletRequest {
    adminId: string
    campaignId: string | null
    paymentTransactionId: string | null
    amount: string
    gateway: string
    description?: string
    sepayMetadata?: string
}

interface CreditFundraiserWalletRequest {
    fundraiserId: string
    campaignId: string | null
    paymentTransactionId: string | null
    amount: string
    gateway: string
    description?: string
}

interface CreditWalletResponse {
    success: boolean
    walletTransactionId?: string
    error?: string
}

const ROLE_MAP = {
    DONOR: 0,
    FUNDRAISER: 1,
    KITCHEN_STAFF: 2,
    DELIVERY_STAFF: 3,
    ADMIN: 4,
}

interface GetUserBasicInfoRequest {
    userId: string
}

interface GetUserBasicInfoResponse {
    success: boolean
    user?: {
        id: string
        role: string
        organizationId: string | null
        organizationName: string | null
    }
    error?: string
}

interface GetUserOrganizationRequest {
    userId: string
}

interface GetUserOrganizationResponse {
    success: boolean
    organization?: {
        id: string
        name: string
    }
    error?: string
}

@Controller()
export class UserGrpcController {
    private readonly logger = new Logger(UserGrpcController.name)

    constructor(
        private readonly userCommonRepository: UserCommonRepository,
        private readonly userAdminRepository: UserAdminRepository,
        private readonly walletRepository: WalletRepository,
        private readonly organizationRepository: OrganizationRepository,
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
        try {
            const { cognitoId, email, fullName, cognitoAttributes } = data

            if (!cognitoId || !email) {
                return {
                    success: false,
                    user: null,
                    error: "Cognito ID and email are required",
                }
            }

            const finalUsername = generateUniqueUsername(email)

            const user = await this.userCommonRepository.createUser({
                cognito_id: cognitoId,
                email,
                user_name: finalUsername,
                full_name: fullName || "",
                avatar_url: cognitoAttributes?.avatarUrl || "",
                bio: cognitoAttributes?.bio || "",
                role: Role.DONOR,
            } as any)

            if (!user) {
                return {
                    success: false,
                    user: null,
                    error: "Failed to create user",
                }
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    cognitoId: user.cognito_id,
                    email: user.email,
                    username: finalUsername,
                    fullName: user.full_name,
                    phoneNumber: user.phone_number || "",
                    avatarUrl: user.avatar_url || "",
                    bio: user.bio || "",
                    role: 0, // DONOR = 0
                    isActive: user.is_active,
                    createdAt: user.created_at.toISOString(),
                    updatedAt: user.updated_at.toISOString(),
                },
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "GetUser")
    async getUser(data: GetUserRequest): Promise<GetUserResponse> {
        try {
            const { cognitoId } = data

            if (!cognitoId) {
                return {
                    success: false,
                    user: null,
                    error: "Cognito ID is required",
                }
            }

            const user =
                await this.userCommonRepository.findUserByCognitoId(cognitoId)

            if (!user) {
                return {
                    success: false,
                    user: null,
                    error: "User not found",
                }
            }

            return {
                success: true,
                user: {
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
                },
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "UpdateUser")
    async updateUser(data: UpdateUserRequest): Promise<UpdateUserResponse> {
        try {
            const { id, fullName, phoneNumber, avatarUrl, bio } = data

            if (!id) {
                return {
                    success: false,
                    user: null,
                    error: "User ID is required",
                }
            }

            const updateData: any = {}
            if (fullName) updateData.full_name = fullName
            if (phoneNumber) updateData.phone_number = phoneNumber
            if (avatarUrl) updateData.avatar_url = avatarUrl
            if (bio) updateData.bio = bio

            const user = await this.userAdminRepository.updateUser(
                id,
                updateData,
            )

            return {
                success: true,
                user: {
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
                },
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message,
            }
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
                await this.userCommonRepository.findUserByCognitoId(cognitoId)

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
                return {
                    success: false,
                    user: null,
                    error: "Email is required",
                }
            }

            const user = await this.userCommonRepository.findUserByEmail(email)

            if (!user) {
                return {
                    success: false,
                    user: null,
                    error: "User not found",
                }
            }

            return {
                success: true,
                user: {
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
                },
                error: null,
            }
        } catch (error) {
            return {
                success: false,
                user: null,
                error: error.message,
            }
        }
    }

    @GrpcMethod("UserService", "CreditFundraiserWallet")
    async creditFundraiserWallet(
        data: CreditFundraiserWalletRequest,
    ): Promise<CreditWalletResponse> {
        try {
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

            const user =
                await this.userCommonRepository.findUserById(fundraiserId)
            if (!user) {
                this.logger.error(
                    `[CreditFundraiserWallet] ❌ Fundraiser ${fundraiserId} not found`,
                )
                return {
                    success: false,
                    error: `Fundraiser ${fundraiserId} not found`,
                }
            }

            // Determine transaction type based on context
            // If gateway is "SYSTEM", it's an admin adjustment (surplus settlement, refund, etc.)
            // Otherwise, it's a donation received
            const transactionType = gateway === "SYSTEM" 
                ? Transaction_Type.ADMIN_ADJUSTMENT 
                : Transaction_Type.DONATION_RECEIVED

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

            return {
                success: true,
                walletTransactionId: transaction.id,
            }
        } catch (error) {
            const errorMessage =
                error?.message || error?.toString() || "Unknown error"
            this.logger.error(
                `[CreditFundraiserWallet] ❌ Failed for fundraiser ${data.fundraiserId}:`,
                error?.stack || errorMessage,
            )
            return {
                success: false,
                error: errorMessage,
            }
        }
    }

    @GrpcMethod("UserService", "CreditAdminWallet")
    async creditAdminWallet(
        data: CreditAdminWalletRequest,
    ): Promise<CreditWalletResponse> {
        try {
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

            // Verify admin user exists
            const user = await this.userCommonRepository.findUserById(adminId)
            if (!user) {
                return {
                    success: false,
                    error: `Admin ${adminId} not found`,
                }
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

            return {
                success: true,
                walletTransactionId: transaction.id,
            }
        } catch (error) {
            this.logger.error(
                "[CreditAdminWallet] Failed:",
                error.stack || error,
            )
            return {
                success: false,
                error: error.message,
            }
        }
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

        const user = await this.userCommonRepository.findUserBasicInfo(userId)

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

        const user = await this.userCommonRepository.findUserBasicInfo(userId)

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
    async getWalletTransactionsByPaymentId(data: {
        paymentTransactionId: string
    }): Promise<{
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
    }> {
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
}
