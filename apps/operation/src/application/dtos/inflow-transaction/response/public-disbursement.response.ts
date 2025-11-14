import { Field, ObjectType } from "@nestjs/graphql"
import { InflowTransactionType } from "../../../../domain/enums"

@ObjectType("PublicDisbursement")
export class PublicDisbursement {
    @Field(() => String, { description: "Disbursement ID" })
        id: string

    @Field(() => String, { description: "Campaign phase ID" })
        campaignPhaseId: string

    @Field(() => InflowTransactionType, {
        description: "Transaction type: INGREDIENT, COOKING, or DELIVERY",
    })
        transactionType: InflowTransactionType

    @Field(() => String, {
        description: "Amount disbursed in VND (as string to handle BigInt)",
    })
        amount: string

    @Field(() => Date, { description: "When the disbursement was created" })
        createdAt: Date

    @Field(() => Date, { description: "When the disbursement was completed" })
        completedAt: Date
}

@ObjectType()
export class CampaignDisbursementSummary {
    @Field(() => String, { description: "Campaign ID" })
        campaignId: string

    @Field(() => String, {
        description: "Total amount disbursed for this campaign (as string)",
    })
        totalDisbursed: string

    @Field(() => [PublicDisbursement], {
        description: "List of completed disbursements (public view)",
    })
        disbursements: PublicDisbursement[]
}
