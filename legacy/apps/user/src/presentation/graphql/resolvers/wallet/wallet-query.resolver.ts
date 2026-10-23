import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { WalletService } from "@app/user/src/application/services"
import {
    WalletSchema,
    WalletTransactionSchema,
} from "../../../../domain/entities"
import { WalletTransactionSearchResult } from "../../../../application/dtos/wallet-transaction-search-result.dto"
import { WalletTransactionSearchService } from "@app/user/src/application/services"
import { SearchWalletTransactionInput } from "@app/user/src/application/dtos"

@Resolver()
export class WalletQueryResolver {
    constructor(
        private readonly walletService: WalletService,
        private readonly walletTransactionSearchService: WalletTransactionSearchService,
    ) { }

    @Query(() => WalletSchema, {
        description: "Get system admin wallet (Public API - No authentication required)",
        nullable: true,
    })
    async getSystemWallet(): Promise<WalletSchema | null> {
        return this.walletService.getSystemWallet()
    }

    @Query(() => WalletSchema, {
        description: "Get wallet by user ID (Public API - No authentication required)",
        nullable: true,
    })
    async getWallet(
        @Args("userId", { type: () => String }) userId: string,
    ): Promise<WalletSchema | null> {
        try {
            return await this.walletService.getPublicWallet(userId)
        } catch (error) {
            return null
        }
    }

    @Query(() => [WalletTransactionSchema], {
        description: "Get wallet transactions by wallet ID (Public API - No authentication required)",
    })
    async getWalletTransactions(
        @Args("walletId", { type: () => String }) walletId: string,
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
        return this.walletService.getWalletTransactionsByWalletId(
            walletId,
            skip,
            limit,
        )
    }

    @Query(() => WalletTransactionSearchResult, {
        description: "Search wallet transactions using OpenSearch",
    })
    async searchWalletTransactions(
        @Args("input") input: SearchWalletTransactionInput,
    ): Promise<WalletTransactionSearchResult> {
        return this.walletTransactionSearchService.search(input)
    }
}