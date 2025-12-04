import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "../../generated/user-client"
import { Transaction_Type, Wallet_Type } from "../../domain/enums/wallet.enum"
import { WalletSchema, WalletTransactionSchema } from "../../domain/entities"

@Injectable()
export class WalletRepository {
    private readonly logger = new Logger(WalletRepository.name)

    constructor(private readonly prisma: PrismaClient) { }

    private mapTransactionToSchema(tx: any): WalletTransactionSchema {
        const schema = new WalletTransactionSchema()
        schema.id = tx.id
        schema.wallet_id = tx.wallet_id
        schema.campaign_id = tx.campaign_id
        schema.payment_transaction_id = tx.payment_transaction_id
        schema.amount = tx.amount?.toString() || "0"
        schema.balance_before = tx.balance_before?.toString() || "0"
        schema.balance_after = tx.balance_after?.toString() || "0"
        schema.transaction_type = tx.transaction_type
        schema.description = tx.description
        schema.gateway = tx.gateway
        schema.sepay_metadata = tx.sepay_metadata
        schema.created_at = tx.created_at
        schema.updated_at = tx.created_at
        return schema
    }

    async getWallet(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<WalletSchema> {
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

        return {
            ...wallet,
            balance: wallet.balance.toString(),
        } as WalletSchema
    }

    async createWallet(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<WalletSchema> {
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

        return {
            ...wallet,
            balance: wallet.balance.toString(),
        } as WalletSchema
    }

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
    }): Promise<WalletTransactionSchema> {
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
                return this.mapTransactionToSchema(existing)
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
                return this.mapTransactionToSchema(existing)
            }
        }

        // Create transaction and update balance in a transaction
        const walletTransaction = await this.prisma.$transaction(async (tx) => {
            // Get current balance before transaction
            const currentWallet = await tx.wallet.findUnique({
                where: { id: wallet.id },
                select: { balance: true },
            })

            const balanceBefore = currentWallet?.balance || BigInt(0)
            const balanceAfter = balanceBefore + data.amount

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
                    balance_before: balanceBefore,
                    balance_after: balanceAfter,
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
                    balance: balanceAfter,
                },
            })

            return transaction
        })

        this.logger.log(
            `Credited ${data.amount} to ${data.walletType} wallet ${wallet.id} - Transaction: ${walletTransaction.id}`,
        )

        return this.mapTransactionToSchema(walletTransaction)
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
    ): Promise<WalletTransactionSchema[]> {
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
    ): Promise<WalletTransactionSchema[]> {
        const transactions = await this.prisma.wallet_Transaction.findMany({
            where: {
                payment_transaction_id: paymentTransactionId,
            },
            orderBy: {
                created_at: "desc",
            },
        })

        return transactions.map((tx) => this.mapTransactionToSchema(tx))
    }

    /**
     * Find all wallets by type with pagination
     */
    async findAllByType(
        walletType: Wallet_Type,
        skip = 0,
        take = 50,
    ): Promise<{ wallets: WalletSchema[]; total: number }> {
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

        // Map Prisma results to domain models
        const mappedWallets = wallets.map((w) => ({
            ...w,
            balance: w.balance.toString(),
        })) as WalletSchema[]

        return { wallets: mappedWallets, total }
    }

    /**
     * Get transactions by wallet ID
     */
    async getTransactionsByWalletId(
        walletId: string,
        skip = 0,
        limit = 50,
    ): Promise<WalletTransactionSchema[]> {
        const transactions = await this.prisma.wallet_Transaction.findMany({
            where: {
                wallet_id: walletId,
            },
            orderBy: {
                created_at: "desc",
            },
            skip,
            take: limit,
        })

        return transactions.map((tx) => this.mapTransactionToSchema(tx))
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
                            Transaction_Type.INCOMING_TRANSFER
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
     * Find wallet transaction by Sepay transaction ID
     */
    async findTransactionBySepayId(
        sepayId: number,
    ): Promise<WalletTransactionSchema | null> {
        const transaction = await this.prisma.wallet_Transaction.findFirst({
            where: {
                sepay_metadata: {
                    path: ["id"],
                    equals: sepayId,
                },
            },
        })

        if (!transaction) {
            return null
        }

        return this.mapTransactionToSchema(transaction)
    }

    /**
     * Atomic withdrawal: Update wallet balance + Create transaction record
     * Used for bank transfers OUT (admin wallet)
     */
    async atomicWithdrawal(data: {
        walletId: string
        amount: bigint
        balanceBefore: bigint
        balanceAfter: bigint
        transactionType: Transaction_Type
        gateway?: string
        description?: string
        sepayMetadata?: any
    }): Promise<WalletTransactionSchema> {
        const walletTransaction = await this.prisma.$transaction(async (tx) => {
            // Create wallet transaction record
            const transaction = await tx.wallet_Transaction.create({
                data: {
                    wallet_id: data.walletId,
                    amount: data.amount,
                    balance_before: data.balanceBefore,
                    balance_after: data.balanceAfter,
                    transaction_type: data.transactionType,
                    description: data.description || null,
                    gateway: data.gateway || null,
                    sepay_metadata: data.sepayMetadata || null,
                },
            })

            // Update wallet balance
            await tx.wallet.update({
                where: { id: data.walletId },
                data: {
                    balance: data.balanceAfter,
                },
            })

            return transaction
        })

        this.logger.log(
            `Withdrawal processed - Amount: ${data.amount}, Wallet: ${data.walletId}, Transaction: ${walletTransaction.id}`,
        )

        return this.mapTransactionToSchema(walletTransaction)
    }

    /**
     * Get platform-wide statistics
     */
    async getPlatformStats(): Promise<{
        totalFundraiserBalance: bigint
        totalFundraisers: number
        totalTransactionsToday: number
        totalTransactionsThisMonth: number
        totalUsers: number
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
        const [totalTransactionsToday, totalTransactionsThisMonth, totalUsers] =
            await Promise.all([
                this.prisma.wallet_Transaction.count({
                    where: {
                        created_at: {
                            gte: startOfToday,
                        },
                    },
                }),
                this.prisma.wallet_Transaction.count({
                    where: {
                        created_at: {
                            gte: startOfMonth,
                        },
                    },
                }),
                this.prisma.user.count(),
            ])

        return {
            totalFundraiserBalance,
            totalFundraisers: fundraiserWallets.length,
            totalTransactionsToday,
            totalTransactionsThisMonth,
            totalUsers,
        }
    }

    async debitWallet(data: {
        userId: string
        walletType: Wallet_Type
        amount: bigint
        transactionType: Transaction_Type
        campaignId: string | null
        description?: string
    }): Promise<WalletTransactionSchema> {
        return this.prisma.$transaction(async (tx) => {
            // Get wallet with lock
            const wallet = await tx.wallet.findFirst({
                where: {
                    user_id: data.userId,
                    wallet_type: data.walletType,
                },
            })

            if (!wallet) {
                throw new Error(
                    `${data.walletType} wallet not found for user ${data.userId}`,
                )
            }

            // Check sufficient balance
            if (wallet.balance < data.amount) {
                throw new Error(
                    `Insufficient balance. Available: ${wallet.balance}, Required: ${data.amount}`,
                )
            }

            const balanceBefore = wallet.balance
            const balanceAfter = balanceBefore - data.amount

            // Create debit transaction (negative amount)
            const transaction = await tx.wallet_Transaction.create({
                data: {
                    wallet_id: wallet.id,
                    campaign_id: data.campaignId,
                    payment_transaction_id: null,
                    amount: data.amount,
                    balance_before: balanceBefore,
                    balance_after: balanceAfter,
                    transaction_type: data.transactionType,
                    description: data.description || "Rút tiền ví",
                    gateway: null,
                    sepay_metadata: {},
                },
            })

            // Update wallet balance
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: balanceAfter },
            })

            this.logger.log(
                `[debitWallet] ✅ Debited ${data.amount} from ${data.walletType} wallet (User: ${data.userId})`,
            )

            return this.mapTransactionToSchema(transaction)
        })
    }
    async findAllTransactions(options?: {
        skip?: number
        take?: number
    }): Promise<WalletTransactionSchema[]> {
        const transactions = await this.prisma.wallet_Transaction.findMany({
            skip: options?.skip,
            take: options?.take,
            orderBy: {
                created_at: "desc",
            },
        })

        return transactions.map((tx) => this.mapTransactionToSchema(tx))
    }

    async findRecentlyUpdatedTransactions(since: Date): Promise<WalletTransactionSchema[]> {
        const transactions = await this.prisma.wallet_Transaction.findMany({
            where: {
                created_at: {
                    gte: since,
                },
            },
            orderBy: {
                created_at: "desc",
            },
        })

        return transactions.map((tx) => this.mapTransactionToSchema(tx))
    }

    async calculateTotalIncome(walletId: string): Promise<bigint> {
        const result = await this.prisma.wallet_Transaction.aggregate({
            where: {
                wallet_id: walletId,
                transaction_type: {
                    in: [
                        Transaction_Type.INCOMING_TRANSFER,
                        Transaction_Type.ADMIN_ADJUSTMENT,
                    ],
                },
            },
            _sum: {
                amount: true,
            },
        })

        return result._sum.amount || BigInt(0)
    }

    async calculateTotalExpense(walletId: string): Promise<bigint> {
        const result = await this.prisma.wallet_Transaction.aggregate({
            where: {
                wallet_id: walletId,
                transaction_type: Transaction_Type.WITHDRAWAL,
            },
            _sum: {
                amount: true,
            },
        })

        const total = result._sum.amount || BigInt(0)
        return total < 0 ? -total : total
    }
}
