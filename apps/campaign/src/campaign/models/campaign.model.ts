import { Directive, Field, Int, ObjectType } from "@nestjs/graphql"
import { Donation } from "../../donation/models/donation.model"
import { CampaignStatus } from "../enum/campaign.enum"
import { CampaignCategory } from "../../campaign-category/models/campaign-category.model"
import { BaseSchema } from "../../shared"
import { User } from "../../shared/model/user.model"

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
        location: string

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

    @Field(() => Date)
        ingredientPurchaseDate: Date

    @Field(() => Date)
        cookingDate: Date

    @Field(() => Date)
        deliveryDate: Date

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
        approvedAt?: Date

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

    @Field(() => [Donation], {
        defaultValue: [],
    })
        donations?: Donation[]

    constructor() {
        super()
    }
}
