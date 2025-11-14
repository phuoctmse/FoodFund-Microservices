import { ObjectType, Field, Directive, Int } from "@nestjs/graphql"
import { AbstractSchema } from "../../shared/helpers/base.schema"
import { Wallet_Type } from "../enums/wallet.enum"
import { WalletTransactionSchema } from "./wallet-transaction.model"

@ObjectType("Wallet")
@Directive("@key(fields: \"id\")")
export class WalletSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User ID who owns this wallet",
    })
        user_id: string

    @Field(() => Wallet_Type, {
        description: "Type of wallet (FUNDRAISER or ADMIN)",
    })
        wallet_type: Wallet_Type

    @Field(() => String, {
        description: "Current balance in VND (as BigInt string)",
    })
        balance: string

    @Field(() => [WalletTransactionSchema], {
        nullable: true,
        description: "Transaction history for this wallet",
    })
        Wallet_Transaction?: WalletTransactionSchema[]

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