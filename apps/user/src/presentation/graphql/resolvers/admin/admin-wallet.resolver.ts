import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { RequireRole } from "@libs/auth"
import { Role } from "@libs/databases"
import { WalletService } from "../../../../application/services/common/wallet.service"
import {
    WalletModel,
    WalletListResponse,
    WalletTransactionModel,
    WalletWithTransactionsModel,
    PlatformWalletStatsModel,
} from "../../models/wallet.model"

@Resolver()
export class AdminWalletResolver {
    constructor(private readonly walletService: WalletService) {}

    @Query(() => [WalletTransactionModel], {
        description: "Get system wallet transactions (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getSystemWalletTransactions(
        @Args("skip", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of transactions to skip",
        })
            skip = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 50,
            description: "Number of transactions to return",
        })
            limit = 50,
    ): Promise<WalletTransactionModel[]> {
        return this.walletService.getSystemWalletTransactions(skip, limit)
    }

    @Query(() => WalletListResponse, {
        description: "Get all fundraiser wallets (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getAllFundraiserWallets(
        @Args("skip", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of wallets to skip",
        })
            skip = 0,
        @Args("take", {
            type: () => Int,
            nullable: true,
            defaultValue: 50,
            description: "Number of wallets to return",
        })
            take = 50,
    ): Promise<WalletListResponse> {
        return this.walletService.getAllFundraiserWallets(skip, take)
    }

    @Query(() => WalletModel, {
        description: "Get fundraiser wallet by user ID (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getFundraiserWallet(
        @Args("userId", { type: () => String }) userId: string,
    ): Promise<WalletModel> {
        return this.walletService.getFundraiserWallet(userId)
    }

    @Query(() => WalletWithTransactionsModel, {
        description:
            "Get fundraiser wallet with transactions by user ID (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getFundraiserWalletWithTransactions(
        @Args("userId", { type: () => String }) userId: string,
        @Args("skip", {
            type: () => Int,
            nullable: true,
            defaultValue: 0,
            description: "Number of transactions to skip",
        })
            skip = 0,
        @Args("limit", {
            type: () => Int,
            nullable: true,
            defaultValue: 50,
            description: "Number of transactions to return",
        })
            limit = 50,
    ): Promise<WalletWithTransactionsModel> {
        return this.walletService.getFundraiserWalletWithTransactions(
            userId,
            skip,
            limit,
        )
    }

    @Query(() => PlatformWalletStatsModel, {
        description: "Get platform-wide wallet statistics (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getPlatformWalletStats(): Promise<PlatformWalletStatsModel> {
        return this.walletService.getPlatformWalletStats()
    }
}
