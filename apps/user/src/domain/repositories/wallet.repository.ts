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

    /**
     * Get or create wallet for a user
     */
    async getOrCreateWallet(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<Wallet> {
        let wallet = await this.prisma.wallet.findFirst({
            where: {
                user_id: userId,
                wallet_type: walletType,
            },
        })

        if (!wallet) {
            wallet = await this.prisma.wallet.create({
                data: {
                    user_id: userId,
                    wallet_type: walletType,
                    balance: BigInt(0),
                },
            })
            this.logger.log(
                `Created new ${walletType} wallet for user ${userId}`,
            )
        }

        return wallet
    }

    /**
     * Credit wallet with transaction
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
        const wallet = await this.getOrCreateWallet(data.userId, data.walletType)

        // Create transaction and update balance in a transaction
        const walletTransaction = await this.prisma.$transaction(
            async (tx) => {
                // Create wallet transaction
                const transaction = await tx.wallet_Transaction.create({
                    data: {
                        wallet_id: wallet.id,
                        campaign_id: data.campaignId || null,
                        payment_transaction_id:
                            data.paymentTransactionId || null,
                        amount: data.amount,
                        transaction_type: data.transactionType,
                        description: data.description || null,
                        gateway: data.gateway || null,
                        sepay_metadata: data.sepayMetadata || null,
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
            },
        )

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
     */
    async getWalletTransactions(
        userId: string,
        walletType: Wallet_Type,
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

        return this.prisma.wallet_Transaction.findMany({
            where: {
                wallet_id: wallet.id,
            },
            orderBy: {
                created_at: "desc",
            },
            take: limit,
        })
    }
}
