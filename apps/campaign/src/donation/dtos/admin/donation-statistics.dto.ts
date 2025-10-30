import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DonationStatistics {
    @Field(() => String, { description: "Total donation amount" })
        totalAmount: string

    @Field(() => Int, { description: "Total number of donations" })
        totalDonations: number

    @Field(() => Int, { description: "Number of successful donations" })
        successfulDonations: number

    @Field(() => Int, { description: "Number of pending donations" })
        pendingDonations: number

    @Field(() => Int, { description: "Number of failed donations" })
        failedDonations: number

    @Field(() => Int, { description: "Number of refunded donations" })
        refundedDonations: number

    @Field(() => String, { description: "Success rate percentage" })
        successRate: string

    @Field(() => Int, { description: "Number of unique donors" })
        uniqueDonors: number

    @Field(() => Int, { description: "Number of campaigns with donations" })
        campaignsWithDonations: number
}

@ObjectType()
export class TopCampaign {
    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => String, { description: "Campaign title" })
        campaignTitle: string

    @Field(() => String, { description: "Total amount received" })
        totalAmount: string

    @Field(() => Int, { description: "Number of donations" })
        donationCount: number
}

@ObjectType()
export class TopDonor {
    @Field(() => String, { description: "Donor ID" })
        donorId: string

    @Field(() => String, { nullable: true, description: "Donor name" })
        donorName?: string

    @Field(() => String, { description: "Total donated amount" })
        totalAmount: string

    @Field(() => Int, { description: "Number of donations" })
        donationCount: number
}

@ObjectType()
export class DonationDashboard {
    @Field(() => DonationStatistics, { description: "Overall statistics" })
        statistics: DonationStatistics

    @Field(() => [TopCampaign], { description: "Top 5 campaigns by amount" })
        topCampaigns: TopCampaign[]

    @Field(() => [TopDonor], { description: "Top 5 donors by amount" })
        topDonors: TopDonor[]
}
