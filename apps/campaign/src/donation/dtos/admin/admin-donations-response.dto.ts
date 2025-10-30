import { Field, Int, ObjectType } from "@nestjs/graphql"
import { Donation } from "../../models/donation.model"

@ObjectType()
export class AdminDonationsResponse {
    @Field(() => [Donation], { description: "List of donations" })
        donations: Donation[]

    @Field(() => Int, { description: "Total count (for pagination)" })
        totalCount: number

    @Field(() => String, { description: "Total amount of filtered donations" })
        totalAmount: string
}
