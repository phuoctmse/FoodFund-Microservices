import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
export class DonationTransactionInfo {
    @Field(() => String, {
        nullable: true,
        description: "Transaction reference",
    })
        reference?: string

    @Field(() => String, { description: "Transaction amount" })
        amount: string

    @Field(() => String, {
        nullable: true,
        description: "Account number used for transaction",
    })
        accountNumber?: string

    @Field(() => String, {
        nullable: true,
        description: "Transaction description",
    })
        description?: string

    @Field(() => Date, {
        nullable: true,
        description: "Transaction datetime",
    })
        transactionDateTime?: Date
}

@ObjectType()
export class DonationPaymentLinkResponse {
    @Field(() => String, { description: "Donation ID" })
        id: string

    @Field(() => String, { nullable: true, description: "Payment order code" })
        orderCode?: string

    @Field(() => String, { description: "Total amount" })
        amount: string

    @Field(() => String, { description: "Amount paid" })
        amountPaid: string

    @Field(() => String, { description: "Amount remaining" })
        amountRemaining: string

    @Field(() => String, { description: "Payment status" })
        status: string

    @Field(() => Date, { description: "Created at" })
        createdAt: Date

    @Field(() => [DonationTransactionInfo], {
        description: "Payment transactions",
    })
        transactions: DonationTransactionInfo[]

    // Banking info - only available for PENDING/UNPAID status
    @Field(() => String, {
        nullable: true,
        description: "QR code for payment (only for PENDING/UNPAID)",
    })
        qrCode?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank account number (only for PENDING/UNPAID)",
    })
        bankNumber?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank account name (only for PENDING/UNPAID)",
    })
        bankAccountName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank full name (only for PENDING/UNPAID)",
    })
        bankFullName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank name (only for PENDING/UNPAID)",
    })
        bankName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank logo URL (only for PENDING/UNPAID)",
    })
        bankLogo?: string

    @Field(() => String, {
        nullable: true,
        description: "Payment description (only for PENDING/UNPAID)",
    })
        description?: string
}
