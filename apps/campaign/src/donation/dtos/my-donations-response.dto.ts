import { Field, ObjectType, Int } from "@nestjs/graphql"
import { Donation } from "../models/donation.model"

@ObjectType()
export class MyDonationsResponse {
    @Field(() => [Donation], { description: "List of user's donations" })
        donations: Donation[]

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
