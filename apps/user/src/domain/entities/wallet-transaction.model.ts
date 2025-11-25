import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { GraphQLJSONObject } from "graphql-type-json"
import { AbstractSchema } from "../../shared/helpers/base.schema"
import { Transaction_Type } from "../enums/wallet.enum"

@ObjectType("WalletTransaction")
@Directive("@key(fields: \"id\")")
export class WalletTransactionSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Wallet ID this transaction belongs to",
        name: "walletId", // GraphQL field name (camelCase)
    })
        wallet_id: string // Database field name (snake_case)

    @Field(() => String, {
        nullable: true,
        description: "Campaign ID (if transaction related to a campaign)",
        name: "campaignId", // GraphQL field name (camelCase)
    })
        campaign_id?: string | null // Database field name (snake_case)

    @Field(() => String, {
        nullable: true,
        description: "Payment transaction ID from payment service",
        name: "paymentTransactionId", // GraphQL field name (camelCase)
    })
        payment_transaction_id?: string | null // Database field name (snake_case)

    @Field(() => String, {
        description: "Transaction amount in VND (as BigInt string)",
    })
        amount: string

    @Field(() => String, {
        description: "Wallet balance before this transaction (as BigInt string)",
        name: "balanceBefore", // GraphQL field name (camelCase)
    })
        balance_before: string // Database field name (snake_case)

    @Field(() => String, {
        description: "Wallet balance after this transaction (as BigInt string)",
        name: "balanceAfter", // GraphQL field name (camelCase)
    })
        balance_after: string // Database field name (snake_case)

    @Field(() => Transaction_Type, {
        description:
            "Type of transaction (INCOMING_TRANSFER, WITHDRAWAL, ADMIN_ADJUSTMENT)",
        name: "transactionType", // GraphQL field name (camelCase)
    })
        transaction_type: Transaction_Type // Database field name (snake_case)

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
        name: "sepayMetadata", // GraphQL field name (camelCase)
    })
        sepay_metadata?: any | null // Database field name (snake_case)

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