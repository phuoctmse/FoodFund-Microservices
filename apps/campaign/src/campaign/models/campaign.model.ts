import { AbstractSchema } from "@libs/databases"
import { CampaignStatus } from "apps/campaign/src/campaign/enum/campaign.enum"
import { CampaignCategory } from "apps/campaign/src/campaign-category/models/campaign-category.model"
import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { Donation } from "../../donation/models/donation.model"
import { UserRef } from "../../shared/reference/user.ref"

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

    @Field(() => String)
        createdBy: string

    @Field(() => String, {
        nullable: true,
        description: "Campaign category ID",
    })
        categoryId?: string

    @Field(() => Date, {
        nullable: true,
        description: "When campaign was approved",
    })
        approvedAt?: Date

    @Field(() => UserRef, {
        nullable: true,
    })
        creator?: UserRef

    @Field(() => CampaignCategory, {
        nullable: true,
        description: "Campaign category",
    })
        category?: CampaignCategory

    @Field(() => [Donation], {
        description: "Campaign donations - resolved by federation",
        defaultValue: [],
    })
        donations?: Donation[]

    constructor() {
        super()
    }
}
