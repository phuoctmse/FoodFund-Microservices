import { Directive, Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { CampaignStatus } from "../enums/campaign.enums"

@ObjectType()
@Directive("@key(fields: \"id\")")
export class Campaign {
    @Field(() => ID, { description: "Unique campaign identifier" })
        id: string

    @Field(() => String, { description: "Campaign title" })
        title: string

    @Field(() => String, { description: "Campaign description" })
        description: string

    @Field(() => String, {
        description: "Campaign cover image URL (CDN or external)",
    })
        coverImage: string

    @Field(() => String, {
        nullable: true,
        description:
            "File key in Digital Ocean Spaces (for internal management)",
    })
        coverImageFileKey?: string

    @Field(() => String, { description: "Campaign location" })
        location: string

    @Field(() => String, {
        description: "Target amount as string (BigInt compatible)",
    })
        targetAmount: string

    @Field(() => Int, { description: "Number of donations received" })
        donationCount: number

    @Field(() => String, {
        description: "Received amount as string (BigInt compatible)",
    })
        receivedAmount: string

    @Field(() => CampaignStatus, { description: "Campaign status" })
        status: CampaignStatus

    @Field(() => Date, { description: "Campaign start date" })
        startDate: Date

    @Field(() => Date, { description: "Campaign end date" })
        endDate: Date

    @Field(() => Boolean, { description: "Whether campaign is active" })
        isActive: boolean

    @Field(() => String, {
        description: "ID of user who created this campaign",
    })
        createdBy: string

    @Field(() => Date, {
        nullable: true,
        description: "When campaign was approved",
    })
        approvedAt?: Date

    @Field(() => Date, { description: "Campaign creation timestamp" })
        createdAt: Date

    @Field(() => Date, { description: "Campaign last update timestamp" })
        updatedAt: Date
}

@ObjectType()
@Directive("@extends")
@Directive("@key(fields: \"id\")")
export class User {
    @Field(() => ID)
    @Directive("@external")
        id: string
}

@ObjectType()
@Directive("@key(fields: \"id\")")
export class Donation {
    @Field(() => ID, { description: "Unique donation identifier" })
        id: string

    @Field(() => String, { description: "ID of user who made the donation" })
        donorId: string

    @Field(() => String, {
        description: "ID of campaign receiving the donation",
    })
        campaignId: string

    @Field(() => String, { description: "Donation amount as string (BigInt)" })
        amount: string

    @Field(() => String, {
        nullable: true,
        description: "Optional message from donor",
    })
        message?: string

    @Field(() => String, {
        nullable: true,
        description: "Payment reference/transaction ID",
    })
        paymentReference?: string

    @Field(() => Boolean, { description: "Whether donation is anonymous" })
        isAnonymous: boolean

    @Field(() => Date, { description: "Donation timestamp" })
        createdAt: Date
}
