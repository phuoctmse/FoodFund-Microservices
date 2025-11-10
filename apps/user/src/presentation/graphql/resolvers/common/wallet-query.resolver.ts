import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { WalletService } from "../../../../application/services/common/wallet.service"
import {
    WalletModel,
    WalletTransactionModel,
    WalletWithTransactionsModel,
} from "../../models/wallet.model"

@Resolver()
export class WalletQueryResolver {
    constructor(private readonly walletService: WalletService) {}

    @Query(() => WalletModel, {
        description: "Get system admin wallet (Public API - No authentication required)",
        nullable: true,
    })
    async getSystemWallet(): Promise<WalletModel | null> {
        return this.walletService.getSystemWallet()
    }

    @Query(() => WalletModel, {
        description: "Get wallet by user ID (Public API - No authentication required)",
        nullable: true,
    })
    async getWallet(
        @Args("userId", { type: () => String }) userId: string,
    ): Promise<WalletModel | null> {
        try {
            return await this.walletService.getPublicWallet(userId)
        } catch (error) {
            return null
        }
    }

    @Query(() => [WalletTransactionModel], {
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
    ): Promise<WalletTransactionModel[]> {
        return this.walletService.getWalletTransactionsByWalletId(
            walletId,
            skip,
            limit,
        )
    }
}