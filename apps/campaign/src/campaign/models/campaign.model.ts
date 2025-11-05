import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { CampaignStatus } from "../enum/campaign.enum"
import { CampaignCategory } from "../../campaign-category/models/campaign-category.model"
import { BaseSchema } from "../../shared"
import { User } from "../../shared/model/user.model"
import { CampaignPhase } from "../../campaign-phase"

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

    @Field(() => String)
        ingredientBudgetPercentage: string

    @Field(() => String)
        cookingBudgetPercentage: string

    @Field(() => String)
        deliveryBudgetPercentage: string

    @Field(() => CampaignStatus)
        status: CampaignStatus

    @Field(() => Date)
        fundraisingStartDate: Date

    @Field(() => Date)
        fundraisingEndDate: Date

    @Field(() => String, {
        nullable: true,
    })
        ingredientFundsAmount?: string

    @Field(() => String, {
        nullable: true,
    })
        cookingFundsAmount?: string

    @Field(() => String, {
        nullable: true,
    })
        deliveryFundsAmount?: string

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
