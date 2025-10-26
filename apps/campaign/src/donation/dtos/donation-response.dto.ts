import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DonationResponse {
    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        donationId?: string

    @Field(() => String, { nullable: true, description: "PayOS checkout URL for payment" })
        checkoutUrl?: string

    @Field(() => String, { nullable: true, description: "PayOS QR code for secure payment" })
        qrCode?: string

    @Field(() => Number, { nullable: true, description: "PayOS order code for transaction tracking" })
        orderCode?: number

    @Field(() => String, { nullable: true, description: "PayOS payment link ID for verification" })
        paymentLinkId?: string
}