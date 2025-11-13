import { Donation } from "@app/campaign/src/domain/entities/donation.model"
import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
export class DonationWithStatus {
    @Field(() => Donation, { description: "Donation information" })
        donation: Donation

    @Field(() => String, {
        description: "Payment transaction status (PENDING, SUCCESS, FAILED, REFUNDED)",
    })
        transactionStatus: string

    @Field(() => String, {
        description: "Payment amount status (PENDING, PARTIAL, COMPLETED, OVERPAID)",
    })
        paymentAmountStatus: string

    @Field(() => String, { description: "Amount from payment link" })
        amount: string

    @Field(() => String, { description: "Actual amount received" })
        receivedAmount: string

    @Field(() => String, { description: "Order code" })
        orderCode: string
}

@ObjectType()
export class MyDonationsResponse {
    @Field(() => [DonationWithStatus], {
        description: "List of user's donations with payment status",
    })
        donations: DonationWithStatus[]

    @Field(() => String, {
        description: "Total amount donated across all campaigns",
    })
        totalAmount: string

    @Field(() => Int, { description: "Total number of successful donations" })
        totalSuccessDonations: number

    @Field(() => Int, {
        description: "Total number of unique campaigns donated to",
    })
        totalDonatedCampaigns: number
}
