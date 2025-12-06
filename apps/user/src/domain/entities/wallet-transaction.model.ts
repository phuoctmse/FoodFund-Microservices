import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { GraphQLJSONObject } from "graphql-type-json"
import { AbstractSchema } from "../../shared/helpers/base.schema"
import { Transaction_Type } from "../enums/wallet.enum"

@ObjectType("WalletTransaction")
@Directive("@key(fields: \"id\")")
export class WalletTransactionSchema extends AbstractSchema {
    @Field(() => String, {
        description: "Wallet ID this transaction belongs to",
        name: "walletId",
    })
        wallet_id: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign ID (if transaction related to a campaign)",
        name: "campaignId",
    })
        campaign_id?: string | null

    @Field(() => String, {
        nullable: true,
        description: "Payment transaction ID from payment service",
        name: "paymentTransactionId",
    })
        payment_transaction_id?: string | null

    @Field(() => String, {
        description: "Transaction amount in VND (as BigInt string)",
    })
        amount: string

    @Field(() => String, {
        description: "Wallet balance before this transaction (as BigInt string)",
        name: "balanceBefore",
    })
        balance_before: string

    @Field(() => String, {
        description: "Wallet balance after this transaction (as BigInt string)",
        name: "balanceAfter",
    })
        balance_after: string

    @Field(() => Transaction_Type, {
        description:
            "Type of transaction (INCOMING_TRANSFER, WITHDRAWAL, ADMIN_ADJUSTMENT)",
        name: "transactionType",
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
        name: "sepayMetadata",
    })
        sepay_metadata?: any | null
}