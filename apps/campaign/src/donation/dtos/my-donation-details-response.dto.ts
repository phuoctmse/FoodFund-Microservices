import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PaymentTransactionDetail {
    @Field(() => String, { description: "Transaction ID" })
        id: string

    @Field(() => String, { description: "Order code" })
        orderCode: string

    @Field(() => String, { description: "Original payment link amount" })
        amount: string

    @Field(() => String, { description: "Actual amount received" })
        receivedAmount: string

    @Field(() => String, { description: "Transaction status" })
        transactionStatus: string

    @Field(() => String, { description: "Payment amount status" })
        paymentAmountStatus: string

    @Field(() => String, { nullable: true, description: "Description" })
        description?: string

    @Field(() => Date, { description: "Created at" })
        createdAt: Date

    @Field(() => Date, { description: "Updated at" })
        updatedAt: Date
}

@ObjectType()
export class MyDonationDetailsResponse {
    @Field(() => String, { description: "Donation ID" })
        donationId: string

    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => Boolean, { description: "Is anonymous donation" })
        isAnonymous: boolean

    @Field(() => Date, { description: "Donation created at" })
        createdAt: Date

    @Field(() => PaymentTransactionDetail, {
        description: "Payment transaction details",
    })
        paymentTransaction: PaymentTransactionDetail
}
