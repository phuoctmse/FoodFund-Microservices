import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DonationResponse {
    @Field(() => String, { description: "Donation ID" })
        donationId: string

    @Field(() => String, { description: "QR code for payment" })
        qrCode: string

    @Field(() => String, { description: "Bank name (short name)" })
        bankName: string

    @Field(() => String, { description: "Bank account number" })
        bankNumber: string

    @Field(() => String, { description: "Bank account holder name" })
        bankAccountName: string

    @Field(() => String, { description: "Bank full name" })
        bankFullName: string

    @Field(() => String, { description: "Bank logo URL" })
        bankLogo: string

    @Field(() => String, { description: "Transfer description/content" })
        description: string

    @Field(() => Number, { description: "Transfer amount in VND" })
        amount: number
}
