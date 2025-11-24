import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { AbstractSchema } from "../../shared/helpers/base.schema"
import { Wallet_Type } from "../enums/wallet.enum"
import { WalletTransactionSchema } from "./wallet-transaction.model"
import { UserProfileSchema } from "./user.model"

@ObjectType("Wallet")
@Directive("@key(fields: \"id\")")
export class WalletSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID who owns this wallet",
        name: "userId", // GraphQL field name (camelCase)
    })
        user_id: string // Database field name (snake_case)

    @Field(() => Wallet_Type, {
        description: "Type of wallet (FUNDRAISER or ADMIN)",
        name: "walletType", // GraphQL field name (camelCase)
    })
        wallet_type: Wallet_Type // Database field name (snake_case)

    @Field(() => String, {
        description: "Current balance in VND (as BigInt string)",
    })
        balance: string

    @Field(() => [WalletTransactionSchema], {
        nullable: true,
        description: "Transaction history for this wallet",
        name: "transactions", // GraphQL field name (camelCase)
    })
        Wallet_Transaction?: WalletTransactionSchema[] // Database relation name

    @Field(() => UserProfileSchema, {
        nullable: true,
        description: "User who owns this wallet",
    })
        user?: UserProfileSchema // For field resolver

    /**
     * Helper method to get balance as BigInt
     */
    getBalanceAsBigInt(): bigint {
        return BigInt(this.balance)
    }

    /**
     * Helper method to format balance for display
     */
    getFormattedBalance(): string {
        const balanceNumber = Number(this.balance)
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(balanceNumber)
    }
}

// Response types for GraphQL
@ObjectType({ description: "Wallet with transactions" })
export class WalletWithTransactionsSchema {
    @Field(() => WalletSchema, { description: "Wallet information" })
        wallet: WalletSchema

    @Field(() => [WalletTransactionSchema], {
        description: "Recent wallet transactions",
    })
        transactions: WalletTransactionSchema[]

    @Field(() => Number, { description: "Total number of transactions" })
        totalTransactions: number
}

@ObjectType({ description: "Wallet statistics" })
export class WalletStatsSchema {
    @Field(() => String, { description: "Total amount received (all time)" })
        totalReceived: string

    @Field(() => String, { description: "Total amount withdrawn (all time)" })
        totalWithdrawn: string

    @Field(() => String, { description: "Available balance" })
        availableBalance: string

    @Field(() => Number, { description: "Total number of donations received" })
        totalDonations: number

    @Field(() => String, { description: "Total received this month" })
        thisMonthReceived: string
}

@ObjectType({ description: "Platform wallet statistics for admin" })
export class PlatformWalletStatsSchema {
    @Field(() => String, { description: "System wallet balance" })
        systemBalance: string

    @Field(() => String, {
        description: "Total balance across all fundraiser wallets",
    })
        totalFundraiserBalance: string

    @Field(() => Number, { description: "Total number of fundraisers" })
        totalFundraisers: number

    @Field(() => Number, { description: "Total transactions today" })
        totalTransactionsToday: number

    @Field(() => Number, { description: "Total transactions this month" })
        totalTransactionsThisMonth: number
}

@ObjectType({ description: "List of wallets for admin view" })
export class WalletListResponseSchema {
    @Field(() => [WalletSchema], { description: "List of wallets" })
        wallets: WalletSchema[]

    @Field(() => Number, { description: "Total number of wallets" })
        total: number
}