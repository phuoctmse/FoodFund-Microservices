import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType({ description: "Detailed transaction statement for CSV export" })
export class DonationTransactionStatement {
    @Field(() => String, { description: "Donation ID" })
        donationId: string

    @Field(() => String, { description: "Transaction date and time" })
        transactionDateTime: string

    @Field(() => String, { description: "Donor name (or Anonymous)" })
        donorName: string

    @Field(() => String, { description: "Donation amount" })
        amount: string

    @Field(() => String, { description: "Actual amount received" })
        receivedAmount: string

    @Field(() => String, { description: "Payment status (SUCCESS/FAILED/PENDING)" })
        transactionStatus: string

    @Field(() => String, { description: "Payment completion status (COMPLETED/PARTIAL/OVERPAID)" })
        paymentStatus: string

    @Field(() => String, { description: "Payment gateway (PAYOS/SEPAY)" })
        gateway: string

    @Field(() => String, { description: "Order code / Reference number" })
        orderCode: string

    @Field(() => String, { nullable: true, description: "Bank account number (if available)" })
        bankAccountNumber?: string

    @Field(() => String, { nullable: true, description: "Bank name (if available)" })
        bankName?: string

    @Field(() => String, { nullable: true, description: "Transfer description/content" })
        description?: string

    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => String, { description: "Campaign title" })
        campaignTitle: string
}

@ObjectType({ description: "Campaign donation statement export response" })
export class CampaignDonationStatementResponse {
    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => String, { description: "Campaign title" })
        campaignTitle: string

    @Field(() => String, { description: "Total amount received" })
        totalReceived: string

    @Field(() => Number, { description: "Total number of successful donations" })
        totalDonations: number

    @Field(() => String, { description: "Statement generation date" })
        generatedAt: string

    @Field(() => [DonationTransactionStatement], {
        description: "List of all donation transactions",
    })
        transactions: DonationTransactionStatement[]
}
