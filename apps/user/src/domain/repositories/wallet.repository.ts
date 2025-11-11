import { Injectable, Logger } from "@nestjs/common"
import {
    Wallet_Type,
    Transaction_Type,
    Wallet,
    Wallet_Transaction,
    PrismaClient,
} from "../../generated/user-client"

@Injectable()
export class WalletRepository {
    private readonly logger = new Logger(WalletRepository.name)

    constructor(private readonly prisma: PrismaClient) {}

    async getWallet(userId: string, walletType: Wallet_Type): Promise<Wallet> {
        const wallet = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        if (!wallet) {
            const errorMessage = `${walletType} wallet not found for user ${userId}. Wallet must be created first.`
            this.logger.error(`[getWallet] ❌ ${errorMessage}`)
            throw new Error(errorMessage)
        }

        return wallet
    }

    /**
     * Create wallet for a user (explicit creation only)
     */
    async createWallet(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<Wallet> {
        // Check if wallet already exists
        const existing = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        if (existing) {
            throw new Error(
                `${walletType} wallet already exists for user ${userId}`,
            )
        }

        const wallet = await this.prisma.wallet.create({
            data: {
                user_id: userId,
                wallet_type: walletType,
                balance: BigInt(0),
            },
        })

        this.logger.log(`Created new ${walletType} wallet for user ${userId}`)

        return wallet
    }

    /**
     * Credit wallet with transaction
     * Implements idempotency to prevent duplicate credits for same gateway+payment combination
     */
    async creditWallet(data: {
        userId: string
        walletType: Wallet_Type
        amount: bigint
        transactionType: Transaction_Type
        campaignId?: string | null
        paymentTransactionId?: string | null
        gateway?: string
        description?: string
        sepayMetadata?: any
    }): Promise<Wallet_Transaction> {
        const wallet = await this.getWallet(data.userId, data.walletType)

        // IDEMPOTENCY CHECK:
        // Case 1: Donation payment (has payment_transaction_id)
        //   - Gateway/metadata stored in Payment_Transaction (apps/campaign DB)
        //   - Wallet_Transaction should NOT have gateway/sepay_metadata (avoid duplicate)
        //   - Check by payment_transaction_id only
        // Case 2: Non-donation transfer (no payment_transaction_id, has gateway+sepay_metadata)
        //   - Gateway/metadata stored in Wallet_Transaction (apps/user DB)
        //   - Check by sepay_metadata.sepayId to prevent duplicates

        if (data.paymentTransactionId) {
            // Case 1: Donation payment - check by payment_transaction_id
            const existing = await this.prisma.wallet_Transaction.findFirst({
                where: {
                    wallet_id: wallet.id,
                    payment_transaction_id: data.paymentTransactionId,
                },
            })

            if (existing) {
                this.logger.warn(
                    `[Idempotency] Skipping duplicate donation credit - Transaction already exists: ${existing.id} (payment=${data.paymentTransactionId})`,
                )
                return existing
            }
        } else if (data.sepayMetadata?.sepayId) {
            // Case 2: Non-donation Sepay transfer - check by sepayId
            const existing = await this.prisma.wallet_Transaction.findFirst({
                where: {
                    wallet_id: wallet.id,
                    payment_transaction_id: null, // Ensure it's a non-donation transfer
                    gateway: "SEPAY",
                    sepay_metadata: {
                        path: ["sepayId"],
                        equals: data.sepayMetadata.sepayId,
                    },
                },
            })

            if (existing) {
                this.logger.warn(
                    `[Idempotency] Skipping duplicate Sepay transfer - Transaction already exists: ${existing.id} (sepayId=${data.sepayMetadata.sepayId})`,
                )
                return existing
            }
        }

        // Create transaction and update balance in a transaction
        const walletTransaction = await this.prisma.$transaction(async (tx) => {
            // Create wallet transaction
            // NOTE: For donation payments (has payment_transaction_id):
            //   - gateway and sepay_metadata should be NULL (stored in Payment_Transaction)
            // For non-donation transfers (no payment_transaction_id):
            //   - gateway and sepay_metadata are stored here
            const transaction = await tx.wallet_Transaction.create({
                data: {
                    wallet_id: wallet.id,
                    campaign_id: data.campaignId || null,
                    payment_transaction_id: data.paymentTransactionId || null,
                    amount: data.amount,
                    transaction_type: data.transactionType,
                    description: data.description || null,
                    // Only store gateway/sepay_metadata if NO payment_transaction_id (non-donation transfer)
                    gateway: data.paymentTransactionId
                        ? null
                        : data.gateway || null,
                    sepay_metadata: data.paymentTransactionId
                        ? null
                        : data.sepayMetadata || null,
                },
            })

            // Update wallet balance
            await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: {
                        increment: data.amount,
                    },
                },
            })

            return transaction
        })

        this.logger.log(
            `Credited ${data.amount} to ${data.walletType} wallet ${wallet.id} - Transaction: ${walletTransaction.id}`,
        )

        return walletTransaction
    }

    /**
     * Get wallet balance
     */
    async getWalletBalance(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<bigint> {
        const wallet = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        return wallet?.balance || BigInt(0)
    }

    /**
     * Get wallet transactions
     * Uses getTransactionsByWalletId internally to avoid duplicate logic
     */
    async getWalletTransactions(
        userId: string,
        walletType: Wallet_Type,
        skip = 0,
        limit = 50,
    ): Promise<Wallet_Transaction[]> {
        const wallet = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        if (!wallet) {
            return []
        }

        // Reuse getTransactionsByWalletId to avoid duplicate query logic
        return this.getTransactionsByWalletId(wallet.id, skip, limit)
    }

    /**
     * Find wallet transactions by payment_transaction_id
     * Used to fetch wallet credits linked to a specific payment
     */
    async findByPaymentTransactionId(
        paymentTransactionId: string,
    ): Promise<Wallet_Transaction[]> {
        return this.prisma.wallet_Transaction.findMany({
            where: {
                payment_transaction_id: paymentTransactionId,
            },
            orderBy: {
                created_at: "desc",
            },
        })
    }

    /**
     * Find all wallets by type with pagination
     */
    async findAllByType(
        walletType: Wallet_Type,
        skip = 0,
        take = 50,
    ): Promise<{ wallets: Wallet[]; total: number }> {
        const [wallets, total] = await Promise.all([
            this.prisma.wallet.findMany({
                where: {
                    wallet_type: walletType,
                },
                skip,
                take,
                orderBy: {
                    created_at: "desc",
                },
            }),
            this.prisma.wallet.count({
                where: {
                    wallet_type: walletType,
                },
            }),
        ])

        return { wallets, total }
    }

    /**
     * Get transactions by wallet ID
     */
    async getTransactionsByWalletId(
        walletId: string,
        skip = 0,
        limit = 50,
    ): Promise<Wallet_Transaction[]> {
        return this.prisma.wallet_Transaction.findMany({
            where: {
                wallet_id: walletId,
            },
            orderBy: {
                created_at: "desc",
            },
            skip,
            take: limit,
        })
    }

    /**
     * Get wallet statistics for a user
     */
    async getWalletStats(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<{
        totalReceived: bigint
        totalWithdrawn: bigint
        totalDonations: number
        thisMonthReceived: bigint
    }> {
        const wallet = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        if (!wallet) {
            return {
                totalReceived: BigInt(0),
                totalWithdrawn: BigInt(0),
                totalDonations: 0,
                thisMonthReceived: BigInt(0),
            }
        }

        // Get start of current month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Get total received (CREDIT transactions)
        const creditTransactions =
            await this.prisma.wallet_Transaction.aggregate({
                where: {
                    wallet_id: wallet.id,
                    transaction_type: {
                        in: [
                            Transaction_Type.DONATION_RECEIVED,
                            Transaction_Type.INCOMING_TRANSFER,
                            Transaction_Type.ADMIN_ADJUSTMENT,
                        ],
                    },
                },
                _sum: {
                    amount: true,
                },
                _count: true,
            })

        // Get total withdrawn (DEBIT transactions)
        const debitTransactions =
            await this.prisma.wallet_Transaction.aggregate({
                where: {
                    wallet_id: wallet.id,
                    transaction_type: Transaction_Type.WITHDRAWAL,
                },
                _sum: {
                    amount: true,
                },
            })

        // Get this month received
        const thisMonthTransactions =
            await this.prisma.wallet_Transaction.aggregate({
                where: {
                    wallet_id: wallet.id,
                    transaction_type: {
                        in: [
                            Transaction_Type.DONATION_RECEIVED,
                            Transaction_Type.INCOMING_TRANSFER,
                        ],
                    },
                    created_at: {
                        gte: startOfMonth,
                    },
                },
                _sum: {
                    amount: true,
                },
            })

        return {
            totalReceived: creditTransactions._sum.amount || BigInt(0),
            totalWithdrawn: debitTransactions._sum.amount || BigInt(0),
            totalDonations: creditTransactions._count || 0,
            thisMonthReceived: thisMonthTransactions._sum.amount || BigInt(0),
        }
    }

    /**
     * Get platform-wide statistics
     */
    async getPlatformStats(): Promise<{
        totalFundraiserBalance: bigint
        totalFundraisers: number
        totalTransactionsToday: number
        totalTransactionsThisMonth: number
    }> {
        // Get all fundraiser wallets
        const fundraiserWallets = await this.prisma.wallet.findMany({
            where: {
                wallet_type: Wallet_Type.FUNDRAISER,
            },
            select: {
                balance: true,
            },
        })

        // Calculate total balance
        const totalFundraiserBalance = fundraiserWallets.reduce(
            (sum, wallet) => sum + wallet.balance,
            BigInt(0),
        )

        // Get start of today
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        // Get start of current month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Count transactions today
        const totalTransactionsToday =
            await this.prisma.wallet_Transaction.count({
                where: {
                    created_at: {
                        gte: startOfToday,
                    },
                },
            })

        // Count transactions this month
        const totalTransactionsThisMonth =
            await this.prisma.wallet_Transaction.count({
                where: {
                    created_at: {
                        gte: startOfMonth,
                    },
                },
            })

        return {
            totalFundraiserBalance,
            totalFundraisers: fundraiserWallets.length,
            totalTransactionsToday,
            totalTransactionsThisMonth,
        }
    }
}
