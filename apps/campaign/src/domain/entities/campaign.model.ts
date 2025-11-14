import { Directive, Field, Float, Int, ObjectType } from "@nestjs/graphql"
import { BaseSchema } from "../../shared"
import { User } from "../../shared/model/user.model"
import { CampaignStatus } from "../enums/campaign/campaign.enum"
import { CampaignCategory } from "./campaign-category.model"
import { CampaignPhase } from "./campaign-phase.model"

@ObjectType("Campaign")
@Directive("@key(fields: \"id\")")
export class Campaign extends BaseSchema {
    @Field(() => String)
        title: string

    @Field(() => String)
        description: string

    @Field(() => String)
        coverImage: string

    @Field(() => String, {
        nullable: true,
    })
        coverImageFileKey?: string

    @Field(() => String)
        targetAmount: string

    @Field(() => Int)
        donationCount: number

    @Field(() => String)
        receivedAmount: string

    @Field(() => CampaignStatus)
        status: CampaignStatus

    @Field(() => Date)
        fundraisingStartDate: Date

    @Field(() => Date)
        fundraisingEndDate: Date

    @Field(() => Int)
        extensionCount: number

    @Field(() => Int)
        extensionDays: number

    @Field(() => Boolean)
        isActive: boolean

    @Field(() => String)
        createdBy: string

    @Field(() => String, {
        nullable: true,
    })
        categoryId?: string

    @Field(() => Date, {
        nullable: true,
    })
        changedStatusAt?: Date

    @Field(() => Date, {
        nullable: true,
    })
        completedAt?: Date

    @Field(() => Float, {
        description:
            "Funding progress percentage (receivedAmount / targetAmount * 100)",
    })
        fundingProgress: number

    @Field(() => Int, {
        description:
            "Days remaining until fundraising ends (-1 if ended, 0 if today)",
    })
        daysRemaining: number

    @Field(() => Int, {
        description: "Number of days campaign has been active",
    })
        daysActive: number

    @Field(() => Int, {
        description: "Total number of execution phases",
    })
        totalPhases: number

    @Field(() => User, {
        nullable: true,
        description: "Campaign creator",
    })
        creator?: User

    @Field(() => CampaignCategory, {
        nullable: true,
    })
        category?: CampaignCategory

    @Field(() => [CampaignPhase], {
        defaultValue: [],
        description: "Execution phases for this campaign",
    })
        phases?: CampaignPhase[]

    constructor() {
        super()
    }
}
