import { Field, ObjectType } from "@nestjs/graphql"
import { InflowTransactionType } from "../../../../domain/enums"
import { Role } from "@libs/databases"

@ObjectType("PublicReceiverInfo")
export class PublicReceiverInfo {
    @Field(() => String, { description: "Receiver user ID" })
        id: string

    @Field(() => String, { description: "Receiver's display name" })
        fullName: string

    @Field(() => String, { description: "Receiver's username" })
        username: string

    @Field(() => String, { description: "Receiver's email" })
        email: string

    @Field(() => Role, { description: "Receiver's role" })
        role: Role
}

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

    @Field(() => String, { 
        description: "S3 URL of bank transfer screenshot proof",
        nullable: true 
    })
        proof?: string

    @Field(() => PublicReceiverInfo, {
        description: "Fundraiser who received the disbursement",
        nullable: true
    })
        receiver?: PublicReceiverInfo

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
