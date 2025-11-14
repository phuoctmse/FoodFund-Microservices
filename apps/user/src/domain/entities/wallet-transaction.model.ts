import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { GraphQLJSONObject } from "graphql-type-json"
import { AbstractSchema } from "../../shared/helpers/base.schema"
import { Transaction_Type } from "../enums/wallet.enum"

@ObjectType("WalletTransaction")
@Directive("@key(fields: \"id\")")
export class WalletTransactionSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Wallet ID this transaction belongs to",
    })
        wallet_id: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign ID (if transaction related to a campaign)",
    })
        campaign_id?: string | null

    @Field(() => String, {
        nullable: true,
        description: "Payment transaction ID from payment service",
    })
        payment_transaction_id?: string | null

    @Field(() => String, {
        description: "Transaction amount in VND (as BigInt string)",
    })
        amount: string

    @Field(() => String, {
        description: "Wallet balance before this transaction (as BigInt string)",
    })
        balance_before: string

    @Field(() => String, {
        description: "Wallet balance after this transaction (as BigInt string)",
    })
        balance_after: string

    @Field(() => Transaction_Type, {
        description:
            "Type of transaction (DONATION_RECEIVED, INCOMING_TRANSFER, WITHDRAWAL, ADMIN_ADJUSTMENT)",
    })
        transaction_type: Transaction_Type

    @Field(() => String, {
        nullable: true,
        description: "Transaction description",
    })
        description?: string | null

    @Field(() => String, {
        nullable: true,
        description: "Payment gateway used (e.g., \"SEPAY\")",
    })
        gateway?: string | null

    @Field(() => GraphQLJSONObject, {
        nullable: true,
        description: "Sepay webhook payload metadata for audit trail",
    })
        sepay_metadata?: any | null

    /**
     * Helper method to get amount as BigInt
     */
    getAmountAsBigInt(): bigint {
        return BigInt(this.amount)
    }

    /**
     * Helper method to format amount for display
     */
    getFormattedAmount(): string {
        const amountNumber = Number(this.amount)
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(amountNumber)
    }

    /**
     * Check if transaction is positive (credit)
     */
    isCredit(): boolean {
        return (
            this.transaction_type === Transaction_Type.DONATION_RECEIVED ||
            this.transaction_type === Transaction_Type.INCOMING_TRANSFER ||
            this.transaction_type === Transaction_Type.ADMIN_ADJUSTMENT
        )
    }

    /**
     * Check if transaction is negative (debit)
     */
    isDebit(): boolean {
        return this.transaction_type === Transaction_Type.WITHDRAWAL
    }
}