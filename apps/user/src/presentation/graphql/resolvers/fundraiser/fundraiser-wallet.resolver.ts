import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { RequireRole, CurrentUser, CurrentUserType } from "@libs/auth"
import { Role } from "@libs/databases"
import { WalletService } from "../../../../application/services/common/wallet.service"
import {
    WalletSchema,
    WalletWithTransactionsSchema,
    WalletStatsSchema,
} from "../../../../domain/entities"
import { Wallet_Type } from "@app/user/src/domain/enums/wallet.enum"

@Resolver()
export class FundraiserWalletResolver {
    constructor(private readonly walletService: WalletService) {}

    @Query(() => WalletSchema, {
        description: "Get my fundraiser wallet",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyWallet(
        @CurrentUser() user: CurrentUserType,
    ): Promise<WalletSchema> {
        return this.walletService.getMyWallet(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
        )
    }

    @Query(() => WalletWithTransactionsSchema, {
        description: "Get my fundraiser wallet with transactions",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyWalletTransactions(
        @CurrentUser() user: CurrentUserType,
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
            description: "Number of recent transactions to fetch",
        })
            limit = 50,
    ): Promise<WalletWithTransactionsSchema> {
        return this.walletService.getMyWalletWithTransactions(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
            skip,
            limit,
        )
    }

    @Query(() => WalletStatsSchema, {
        description: "Get my fundraiser wallet statistics",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyWalletStats(
        @CurrentUser() user: CurrentUserType,
    ): Promise<WalletStatsSchema> {
        return this.walletService.getMyWalletStats(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
        )
    }
}
