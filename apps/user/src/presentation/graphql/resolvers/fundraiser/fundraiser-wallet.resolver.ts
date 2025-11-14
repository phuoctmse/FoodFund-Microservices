import { Args, Int, Query, Resolver } from "@nestjs/graphql"
import { RequireRole, CurrentUser, CurrentUserType } from "@libs/auth"
import { Role } from "@libs/databases"
import { WalletService } from "../../../../application/services/common/wallet.service"
import {
    WalletModel,
    WalletWithTransactionsModel,
    WalletStatsModel,
} from "../../models/wallet.model"
import { Wallet_Type } from "@app/user/src/domain/enums/wallet.enum"

@Resolver()
export class FundraiserWalletResolver {
    constructor(private readonly walletService: WalletService) {}

    @Query(() => WalletModel, {
        description: "Get my fundraiser wallet",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyWallet(
        @CurrentUser() user: CurrentUserType,
    ): Promise<WalletModel> {
        return this.walletService.getMyWallet(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
        )
    }

    @Query(() => WalletWithTransactionsModel, {
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
    ): Promise<WalletWithTransactionsModel> {
        return this.walletService.getMyWalletWithTransactions(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
            skip,
            limit,
        )
    }

    @Query(() => WalletStatsModel, {
        description: "Get my fundraiser wallet statistics",
    })
    @RequireRole(Role.FUNDRAISER)
    async getMyWalletStats(
        @CurrentUser() user: CurrentUserType,
    ): Promise<WalletStatsModel> {
        return this.walletService.getMyWalletStats(
            user.cognitoId,
            Wallet_Type.FUNDRAISER,
        )
    }
}
