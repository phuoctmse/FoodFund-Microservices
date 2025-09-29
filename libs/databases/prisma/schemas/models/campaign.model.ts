import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { AbstractSchema } from "../abstract.schema"
import { UserProfileSchema } from "./user-profiles.model"
import { Donation } from "./donation.model"
import { CampaignStatus } from "../enums/campaign.enum"

@ObjectType("Campaign")
@Directive("@key(fields: \"id\")")
export class Campaign extends AbstractSchema {
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

    @Field(() => UserProfileSchema, {
        nullable: true,
        description:
            "Campaign Creator - resolved by User service via federation",
    })
        creator?: UserProfileSchema

    @Field(() => [Donation], {
        description: "Campaign donations - resolved by federation",
        defaultValue: [],
    })
        donations?: Donation[]

    constructor() {
        super()
    }
}
