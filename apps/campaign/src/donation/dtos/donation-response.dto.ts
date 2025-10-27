import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DonationResponse {
    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        donationId?: string

    @Field(() => String, {
        nullable: true,
        description: "QR code for bank transfer",
    })
        qrCode?: string

    @Field(() => String, {
        nullable: true,
        description: "PayOS checkout URL for web payment",
    })
        checkoutUrl?: string

    @Field(() => Number, {
        nullable: true,
        description: "Order code for transaction tracking",
    })
        orderCode?: number

    @Field(() => String, {
        nullable: true,
        description: "Payment link ID for verification",
    })
        paymentLinkId?: string

    // Bank transfer information for manual payment
    @Field(() => String, {
        nullable: true,
        description: "Bank name (e.g., MB Bank)",
    })
        bankName?: string

    @Field(() => String, { nullable: true, description: "Bank account number" })
        accountNumber?: string

    @Field(() => String, { nullable: true, description: "Account holder name" })
        accountName?: string

    @Field(() => Number, {
        nullable: true,
        description: "Transfer amount in VND",
    })
        amount?: number

    @Field(() => String, {
        nullable: true,
        description: "Transfer description/content",
    })
        description?: string
}
