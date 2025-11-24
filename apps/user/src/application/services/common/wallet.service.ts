import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { WalletRepository } from "../../repositories/wallet.repository"
import {
    WalletSchema,
    WalletTransactionSchema,
    WalletWithTransactionsSchema,
    WalletListResponseSchema,
    WalletStatsSchema,
    PlatformWalletStatsSchema,
} from "../../../domain/entities"
import { Transaction_Type, Wallet_Type } from "@app/user/src/domain/enums/wallet.enum"
import { UserRepository } from "../../repositories"

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name)

    constructor(
        private readonly walletRepository: WalletRepository,
        private readonly userRepository: UserRepository,
    ) {}

    /**
     * Get wallet for current user (fundraiser)
     */
    async getMyWallet(
        cognitoId: string,
        walletType: Wallet_Type,
    ): Promise<WalletSchema> {
        // Get user by cognitoId
        const user = await this.userRepository.findUserByCognitoId(cognitoId)

        if (!user) {
            throw new NotFoundException("User not found")
        }

        // Get wallet
        const wallet = await this.walletRepository.getWallet(
            user.id,
            walletType,
        )

        return this.mapWalletToModel(wallet)
    }

    /**
     * Get wallet with transactions for current user
     */
    async getMyWalletWithTransactions(
        cognitoId: string,
        walletType: Wallet_Type,
        skip = 0,
        limit = 50,
    ): Promise<WalletWithTransactionsSchema> {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)

        if (!user) {
            throw new NotFoundException("User not found")
        }

        const wallet = await this.walletRepository.getWallet(
            user.id,
            walletType,
        )

        const transactions =
            await this.walletRepository.getWalletTransactions(
                user.id,
                walletType,
                skip,
                limit,
            )

        // Get total count (same as transactions length for now)
        const totalTransactions = transactions.length

        return {
            wallet: this.mapWalletToModel(wallet),
            transactions: transactions.map((tx) =>
                this.mapTransactionToModel(tx),
            ),
            totalTransactions,
        }
    }

    /**
     * Admin: Get all fundraiser wallets
     */
    async getAllFundraiserWallets(
        skip = 0,
        take = 50,
    ): Promise<WalletListResponseSchema> {
        const { wallets, total } =
            await this.walletRepository.findAllByType(
                Wallet_Type.FUNDRAISER,
                skip,
                take,
            )

        return {
            wallets: wallets.map((w) => this.mapWalletToModel(w)),
            total,
        }
    }

    /**
     * Admin: Get wallet transactions by wallet ID
     */
    async getWalletTransactionsByWalletId(
        walletId: string,
        skip = 0,
        limit = 50,
    ): Promise<WalletTransactionSchema[]> {
        const transactions =
            await this.walletRepository.getTransactionsByWalletId(
                walletId,
                skip,
                limit,
            )

        return transactions.map((tx) => this.mapTransactionToModel(tx))
    }

    /**
     * Admin: Get wallet by user ID
     */
    async getWalletByUserId(
        userId: string,
        walletType: Wallet_Type,
    ): Promise<WalletSchema> {
        const wallet = await this.walletRepository.getWallet(userId, walletType)
        return this.mapWalletToModel(wallet)
    }

    /**
     * Public: Get wallet by user ID (for public transparency)
     * Returns fundraiser wallet by default for public viewing
     */
    async getPublicWallet(userId: string): Promise<WalletSchema | null> {
        try {
            // Public API only shows FUNDRAISER wallets for transparency
            return await this.getWalletByUserId(userId, Wallet_Type.FUNDRAISER)
        } catch (error) {
            // Return null if wallet doesn't exist
            if (error instanceof NotFoundException) {
                return null
            }
            throw error
        }
    }

    /**
     * Public: Get system admin wallet (for public transparency)
     * Returns the admin wallet of the system admin user
     */
    async getSystemWallet(): Promise<WalletSchema | null> {
        try {
            const config = envConfig()
            const systemAdminId = config.systemAdminId

            if (!systemAdminId) {
                this.logger.warn("System admin ID not configured in environment")
                return null
            }

            // Get user by cognito ID (system admin)
            const user = await this.userRepository.findUserById(
                systemAdminId,
            )

            if (!user) {
                this.logger.warn(`System admin user not found: ${systemAdminId}`)
                return null
            }

            // Get admin wallet for this user
            return await this.getWalletByUserId(user.id, Wallet_Type.ADMIN)
        } catch (error) {
            // Return null if wallet doesn't exist
            if (error instanceof NotFoundException) {
                return null
            }
            throw error
        }
    }

    /**
     * Fundraiser: Get wallet statistics
     */
    async getMyWalletStats(
        cognitoId: string,
        walletType: Wallet_Type,
    ): Promise<WalletStatsSchema> {
        const user = await this.userRepository.findUserByCognitoId(cognitoId)

        if (!user) {
            throw new NotFoundException("User not found")
        }

        const stats = await this.walletRepository.getWalletStats(
            user.id,
            walletType,
        )

        // Get current balance
        const wallet = await this.walletRepository.getWallet(user.id, walletType)

        return {
            totalReceived: stats.totalReceived.toString(),
            totalWithdrawn: stats.totalWithdrawn.toString(),
            availableBalance: wallet.balance.toString(),
            totalDonations: stats.totalDonations,
            thisMonthReceived: stats.thisMonthReceived.toString(),
        }
    }

    /**
     * Admin: Get fundraiser wallet by user ID
     */
    async getFundraiserWallet(userId: string): Promise<WalletSchema> {
        return this.getWalletByUserId(userId, Wallet_Type.FUNDRAISER)
    }

    /**
     * Admin: Get fundraiser wallet with transactions by user ID
     */
    async getFundraiserWalletWithTransactions(
        userId: string,
        skip = 0,
        limit = 50,
    ): Promise<WalletWithTransactionsSchema> {
        const wallet = await this.getWalletByUserId(
            userId,
            Wallet_Type.FUNDRAISER,
        )
        const transactions =
            await this.walletRepository.getTransactionsByWalletId(
                wallet.id,
                skip,
                limit,
            )

        return {
            wallet,
            transactions: transactions.map((tx) => this.mapTransactionToModel(tx)),
            totalTransactions: transactions.length,
        }
    }

    /**
     * Admin: Get system wallet transactions
     */
    async getSystemWalletTransactions(
        skip = 0,
        limit = 50,
    ): Promise<WalletTransactionSchema[]> {
        const systemWallet = await this.getSystemWallet()

        if (!systemWallet) {
            return []
        }

        const transactions =
            await this.walletRepository.getTransactionsByWalletId(
                systemWallet.id,
                skip,
                limit,
            )

        return transactions.map((tx) => this.mapTransactionToModel(tx))
    }

    /**
     * Admin: Get platform-wide wallet statistics
     */
    async getPlatformWalletStats(): Promise<PlatformWalletStatsSchema> {
        const stats = await this.walletRepository.getPlatformStats()
        const systemWallet = await this.getSystemWallet()

        return {
            systemBalance: systemWallet?.balance.toString() || "0",
            totalFundraiserBalance: stats.totalFundraiserBalance.toString(),
            totalFundraisers: stats.totalFundraisers,
            totalTransactionsToday: stats.totalTransactionsToday,
            totalTransactionsThisMonth: stats.totalTransactionsThisMonth,
        }
    }

    // Helper methods
    private mapWalletToModel(wallet: any): WalletSchema {
        // Return domain entity directly - GraphQL will handle field name mapping
        return {
            id: wallet.id,
            user_id: wallet.user_id, // Keep snake_case for domain entity
            wallet_type: wallet.wallet_type, // Keep snake_case for domain entity
            balance: wallet.balance.toString(),
            created_at: wallet.created_at,
            updated_at: wallet.updated_at,
        } as WalletSchema
    }

    private mapTransactionToModel(tx: any): WalletTransactionSchema {
        // Return domain entity directly - GraphQL will handle field name mapping
        return {
            id: tx.id,
            wallet_id: tx.wallet_id, // Keep snake_case for domain entity
            campaign_id: tx.campaign_id || null,
            payment_transaction_id: tx.payment_transaction_id || null,
            amount: tx.amount.toString(),
            balance_before: tx.balance_before?.toString() || "0",
            balance_after: tx.balance_after?.toString() || "0",
            transaction_type: tx.transaction_type, // Keep enum as-is
            description: tx.description || null,
            gateway: tx.gateway || null,
            sepay_metadata: tx.sepay_metadata || null,
            created_at: tx.created_at,
            updated_at: tx.updated_at,
        } as WalletTransactionSchema
    }
}
