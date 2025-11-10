import { Field, ObjectType, registerEnumType } from "@nestjs/graphql"
import { UserProfileSchema } from "../../../domain/entities/user.model"

export enum WalletTypeEnum {
    FUNDRAISER = "FUNDRAISER",
    ADMIN = "ADMIN",
}

export enum TransactionTypeEnum {
    CREDIT = "CREDIT",
    DEBIT = "DEBIT",
}

registerEnumType(WalletTypeEnum, {
    name: "WalletType",
    description: "Wallet types in the system (FUNDRAISER or ADMIN)",
})

registerEnumType(TransactionTypeEnum, {
    name: "TransactionType",
    description: "Transaction types (credit or debit)",
})

@ObjectType({ description: "User wallet information" })
export class WalletModel {
    @Field(() => String, { description: "Wallet ID" })
        id: string

    @Field(() => String, { description: "User ID who owns this wallet" })
        userId: string

    @Field(() => UserProfileSchema, {
        description: "User information",
        nullable: true,
    })
        user?: UserProfileSchema

    @Field(() => WalletTypeEnum, { description: "Wallet type" })
        walletType: WalletTypeEnum

    @Field(() => String, { description: "Current wallet balance" })
        balance: string

    @Field(() => Date, { description: "Wallet created at" })
        createdAt: Date

    @Field(() => Date, { description: "Wallet updated at" })
        updatedAt: Date
}

@ObjectType({ description: "Wallet transaction details" })
export class WalletTransactionModel {
    @Field(() => String, { description: "Transaction ID" })
        id: string

    @Field(() => String, { description: "Wallet ID" })
        walletId: string

    @Field(() => String, { description: "Transaction amount" })
        amount: string

    @Field(() => TransactionTypeEnum, { description: "Transaction type" })
        transactionType: TransactionTypeEnum

    @Field(() => String, { nullable: true, description: "Campaign ID if related" })
        campaignId?: string

    @Field(() => String, {
        nullable: true,
        description: "Payment transaction ID if related",
    })
        paymentTransactionId?: string

    @Field(() => String, { nullable: true, description: "Payment gateway" })
        gateway?: string

    @Field(() => String, { nullable: true, description: "Transaction description" })
        description?: string

    @Field(() => Date, { description: "Transaction created at" })
        createdAt: Date
}

@ObjectType({ description: "Wallet with transactions" })
export class WalletWithTransactionsModel {
    @Field(() => WalletModel, { description: "Wallet information" })
        wallet: WalletModel

    @Field(() => [WalletTransactionModel], {
        description: "Recent wallet transactions",
    })
        transactions: WalletTransactionModel[]

    @Field(() => Number, { description: "Total number of transactions" })
        totalTransactions: number
}

@ObjectType({ description: "List of wallets for admin view" })
export class WalletListResponse {
    @Field(() => [WalletModel], { description: "List of wallets" })
        wallets: WalletModel[]

    @Field(() => Number, { description: "Total number of wallets" })
        total: number
}

@ObjectType({ description: "Fundraiser wallet statistics" })
export class WalletStatsModel {
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
export class PlatformWalletStatsModel {
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
