import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql"
import { RequireRole } from "@libs/auth"
import { Role } from "@libs/databases"
import { WalletService } from "@app/user/src/application/services"
import {
    WalletSchema,
    WalletListResponseSchema,
    WalletTransactionSchema,
    WalletWithTransactionsSchema,
    PlatformWalletStatsSchema,
} from "../../../../domain/entities"
import { SyncResult } from "../../../../application/dtos/sync-result.dto"
import { WalletTransactionSearchService } from "@app/user/src/application/services"

@Resolver()
export class AdminWalletResolver {
    constructor(
        private readonly walletService: WalletService,
        private readonly walletTransactionSearchService: WalletTransactionSearchService,
    ) { }

    @Query(() => [WalletTransactionSchema], {
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
    ): Promise<WalletTransactionSchema[]> {
        return this.walletService.getSystemWalletTransactions(skip, limit)
    }

    @Query(() => WalletListResponseSchema, {
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
    ): Promise<WalletListResponseSchema> {
        return this.walletService.getAllFundraiserWallets(skip, take)
    }

    @Query(() => WalletSchema, {
        description: "Get fundraiser wallet by user ID (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getFundraiserWallet(
        @Args("userId", { type: () => String }) userId: string,
    ): Promise<WalletSchema> {
        return this.walletService.getFundraiserWallet(userId)
    }

    @Query(() => WalletWithTransactionsSchema, {
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
    ): Promise<WalletWithTransactionsSchema> {
        return this.walletService.getFundraiserWalletWithTransactions(
            userId,
            skip,
            limit,
        )
    }

    @Query(() => PlatformWalletStatsSchema, {
        description: "Get platform-wide wallet statistics (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async getPlatformWalletStats(): Promise<PlatformWalletStatsSchema> {
        return this.walletService.getPlatformWalletStats()
    }

    @Mutation(() => SyncResult, {
        description: "Sync all wallet transactions to OpenSearch (Admin only)",
    })
    @RequireRole(Role.ADMIN)
    async syncWalletTransactions(): Promise<SyncResult> {
        return this.walletTransactionSearchService.syncAll()
    }
}

