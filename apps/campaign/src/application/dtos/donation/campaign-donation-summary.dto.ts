import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType({ description: "Campaign donation summary for public view" })
export class CampaignDonationSummary {
    @Field(() => String, { description: "Donation amount" })
        amount: string

    @Field(() => String, { description: "Donor name (or 'Người dùng ẩn danh' if anonymous)" })
        donorName: string

    @Field(() => Date, {
        nullable: true,
        description: "Transaction datetime from successful payment",
    })
        transactionDatetime?: Date
}
