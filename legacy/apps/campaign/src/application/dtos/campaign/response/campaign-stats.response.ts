import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class CampaignOverviewStats {
    @Field(() => Int, { description: "Total number of campaigns" })
        totalCampaigns: number

    @Field(() => Int, { description: "Number of active campaigns" })
        activeCampaigns: number

    @Field(() => Int, { description: "Number of completed campaigns" })
        completedCampaigns: number
}

@ObjectType()
export class CampaignStatusBreakdown {
    @Field(() => Int, { description: "Pending approval" })
        pending: number

    @Field(() => Int, { description: "Approved, waiting to start" })
        approved: number

    @Field(() => Int, { description: "Currently fundraising" })
        active: number

    @Field(() => Int, { description: "Executing phases" })
        processing: number

    @Field(() => Int, { description: "Successfully completed" })
        completed: number

    @Field(() => Int, { description: "Rejected by admin" })
        rejected: number

    @Field(() => Int, { description: "Cancelled" })
        cancelled: number
}

@ObjectType()
export class CampaignFinancialStats {
    @Field(() => String, {
        description: "Total target amount across all campaigns (VND)",
    })
        totalTargetAmount: string

    @Field(() => String, {
        description: "Total received amount from all donations (VND)",
    })
        totalReceivedAmount: string

    @Field(() => Int, { description: "Total number of donations" })
        totalDonations: number

    @Field(() => String, {
        description: "Average donation amount (VND)",
    })
        averageDonationAmount: string

    @Field(() => Float, {
        description: "Overall funding completion rate (%)",
    })
        fundingRate: number
}

@ObjectType("CategoryStats")
export class CampaignCategoryStats {
    @Field(() => String, { description: "Category ID" })
        categoryId: string

    @Field(() => String, { description: "Category title" })
        categoryTitle: string

    @Field(() => Int, { description: "Number of campaigns in this category" })
        campaignCount: number

    @Field(() => String, {
        description: "Total received amount in this category (VND)",
    })
        totalReceivedAmount: string
}

@ObjectType()
export class MostFundedCampaign {
    @Field(() => String, { description: "Campaign ID" })
        id: string

    @Field(() => String, { description: "Campaign title" })
        title: string
}

@ObjectType()
export class CampaignPerformanceStats {
    @Field(() => Float, {
        description: "Success rate (completed / total * 100)",
    })
        successRate: number

    @Field(() => Float, {
        description: "Average campaign duration in days",
        nullable: true,
    })
        averageDurationDays?: number

    @Field(() => MostFundedCampaign, {
        nullable: true,
    })
        mostFundedCampaign?: MostFundedCampaign
}

@ObjectType()
export class CampaignTimeRangeStats {
    @Field(() => Date, { description: "Start date of time range" })
        startDate: Date

    @Field(() => Date, { description: "End date of time range" })
        endDate: Date

    @Field(() => Int, { description: "Campaigns created in this period" })
        campaignsCreated: number

    @Field(() => Int, { description: "Campaigns completed in this period" })
        campaignsCompleted: number

    @Field(() => String, {
        description: "Total raised in this period (VND)",
    })
        totalRaised: string

    @Field(() => Int, { description: "Donations made in this period" })
        donationsMade: number
}

@ObjectType()
export class CampaignStatsResponse {
    @Field(() => CampaignOverviewStats, { description: "High-level overview" })
        overview: CampaignOverviewStats

    @Field(() => CampaignStatusBreakdown, {
        description: "Breakdown by campaign status",
    })
        byStatus: CampaignStatusBreakdown

    @Field(() => CampaignFinancialStats, {
        description: "Financial metrics",
    })
        financial: CampaignFinancialStats

    @Field(() => [CampaignCategoryStats], {
        description: "Breakdown by category",
    })
        byCategory: CampaignCategoryStats[]

    @Field(() => CampaignPerformanceStats, {
        description: "Performance metrics",
    })
        performance: CampaignPerformanceStats

    @Field(() => CampaignTimeRangeStats, {
        nullable: true,
        description: "Time-based stats (optional filter)",
    })
        timeRange?: CampaignTimeRangeStats
}