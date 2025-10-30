import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PaymentLinkTransaction {
    @Field(() => String, { description: "Transaction reference" })
        reference: string

    @Field(() => Number, { description: "Transaction amount" })
        amount: number

    @Field(() => String, { description: "Account number" })
        accountNumber: string

    @Field(() => String, { description: "Transaction description" })
        description: string

    @Field(() => String, { description: "Transaction datetime" })
        transactionDateTime: string

    @Field(() => String, { nullable: true, description: "Virtual account name" })
        virtualAccountName?: string

    @Field(() => String, { nullable: true, description: "Virtual account number" })
        virtualAccountNumber?: string

    @Field(() => String, { nullable: true, description: "Counter account bank ID" })
        counterAccountBankId?: string

    @Field(() => String, { nullable: true, description: "Counter account bank name" })
        counterAccountBankName?: string

    @Field(() => String, { nullable: true, description: "Counter account name" })
        counterAccountName?: string

    @Field(() => String, { nullable: true, description: "Counter account number" })
        counterAccountNumber?: string
}

@ObjectType()
export class PaymentLinkInfo {
    @Field(() => String, { description: "Payment link ID" })
        id: string

    @Field(() => String, { description: "Order code" })
        orderCode: string

    @Field(() => Number, { description: "Total amount" })
        amount: number

    @Field(() => Number, { description: "Amount paid" })
        amountPaid: number

    @Field(() => Number, { description: "Amount remaining" })
        amountRemaining: number

    @Field(() => String, { description: "Payment link status" })
        status: string

    @Field(() => String, { description: "Created at" })
        createdAt: string

    @Field(() => [PaymentLinkTransaction], {
        description: "List of transactions",
    })
        transactions: PaymentLinkTransaction[]

    @Field(() => String, {
        nullable: true,
        description: "Cancellation reason if cancelled",
    })
        cancellationReason?: string

    @Field(() => String, {
        nullable: true,
        description: "Cancelled at datetime",
    })
        canceledAt?: string

    // Banking info for PENDING status
    @Field(() => String, {
        nullable: true,
        description: "QR code for payment (PENDING status only)",
    })
        qrCode?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank account number (PENDING status only)",
    })
        bankNumber?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank account name (PENDING status only)",
    })
        bankAccountName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank full name (PENDING status only)",
    })
        bankFullName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank name (PENDING status only)",
    })
        bankName?: string

    @Field(() => String, {
        nullable: true,
        description: "Bank logo URL (PENDING status only)",
    })
        bankLogo?: string

    @Field(() => String, {
        nullable: true,
        description: "Payment description (PENDING status only)",
    })
        description?: string
}
