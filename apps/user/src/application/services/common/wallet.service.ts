import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import { envConfig } from "@libs/env"
import { WalletRepository } from "../../repositories/wallet.repository"
import { UserCommonRepository } from "../../repositories"
import {
    WalletModel,
    WalletTransactionModel,
    WalletWithTransactionsModel,
    WalletListResponse,
    WalletTypeEnum,
    TransactionTypeEnum,
    WalletStatsModel,
    PlatformWalletStatsModel,
} from "../../../presentation/graphql/models/wallet.model"
import { Transaction_Type, Wallet_Type } from "@app/user/src/domain/enums/wallet.enum"

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name)

    constructor(
        private readonly walletRepository: WalletRepository,
        private readonly userRepository: UserCommonRepository,
    ) {}

    /**
     * Get wallet for current user (fundraiser)
     */
    async getMyWallet(
        cognitoId: string,
        walletType: Wallet_Type,
    ): Promise<WalletModel> {
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
    ): Promise<WalletWithTransactionsModel> {
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
    ): Promise<WalletListResponse> {
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
    ): Promise<WalletTransactionModel[]> {
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
    ): Promise<WalletModel> {
        const wallet = await this.walletRepository.getWallet(userId, walletType)
        return this.mapWalletToModel(wallet)
    }

    /**
     * Public: Get wallet by user ID (for public transparency)
     * Returns fundraiser wallet by default for public viewing
     */
    async getPublicWallet(userId: string): Promise<WalletModel | null> {
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
    async getSystemWallet(): Promise<WalletModel | null> {
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
    ): Promise<WalletStatsModel> {
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
    async getFundraiserWallet(userId: string): Promise<WalletModel> {
        return this.getWalletByUserId(userId, Wallet_Type.FUNDRAISER)
    }

    /**
     * Admin: Get fundraiser wallet with transactions by user ID
     */
    async getFundraiserWalletWithTransactions(
        userId: string,
        skip = 0,
        limit = 50,
    ): Promise<WalletWithTransactionsModel> {
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
    ): Promise<WalletTransactionModel[]> {
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
    async getPlatformWalletStats(): Promise<PlatformWalletStatsModel> {
        const stats = await this.walletRepository.getPlatformStats()
        const systemWallet = await this.getSystemWallet()

        return {
            systemBalance: systemWallet?.balance || "0",
            totalFundraiserBalance: stats.totalFundraiserBalance.toString(),
            totalFundraisers: stats.totalFundraisers,
            totalTransactionsToday: stats.totalTransactionsToday,
            totalTransactionsThisMonth: stats.totalTransactionsThisMonth,
        }
    }

    // Helper methods
    private mapWalletToModel(wallet: any): WalletModel {
        return {
            id: wallet.id,
            userId: wallet.user_id,
            walletType: this.mapWalletType(wallet.wallet_type),
            balance: wallet.balance.toString(),
            createdAt: wallet.created_at,
            updatedAt: wallet.updated_at,
        }
    }

    private mapTransactionToModel(tx: any): WalletTransactionModel {
        return {
            id: tx.id,
            walletId: tx.wallet_id,
            amount: tx.amount.toString(),
            transactionType: this.mapTransactionType(tx.transaction_type),
            campaignId: tx.campaign_id || undefined,
            paymentTransactionId: tx.payment_transaction_id || undefined,
            gateway: tx.gateway || undefined,
            description: tx.description || undefined,
            createdAt: tx.created_at,
        }
    }

    private mapWalletType(type: Wallet_Type): WalletTypeEnum {
        switch (type) {
        case Wallet_Type.FUNDRAISER:
            return WalletTypeEnum.FUNDRAISER
        case Wallet_Type.ADMIN:
            return WalletTypeEnum.ADMIN
        default:
            return WalletTypeEnum.FUNDRAISER // Default fallback
        }
    }

    private mapTransactionType(type: Transaction_Type): TransactionTypeEnum {
        // Map all transaction types to CREDIT/DEBIT
        switch (type) {
        case Transaction_Type.DONATION_RECEIVED:
        case Transaction_Type.INCOMING_TRANSFER:
        case Transaction_Type.ADMIN_ADJUSTMENT:
            return TransactionTypeEnum.CREDIT
        case Transaction_Type.WITHDRAWAL:
            return TransactionTypeEnum.DEBIT
        default:
            return TransactionTypeEnum.CREDIT // Default fallback
        }
    }
}
