import { Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema, CampaignPhase, User } from "../../shared"
import { InflowTransactionStatus, InflowTransactionType } from "../enums"

@ObjectType("InflowTransaction")
export class InflowTransaction extends BaseSchema {
    @Field(() => String, { description: "Campaign phase ID" })
        campaignPhaseId: string

    @Field(() => String, { nullable: true, description: "Linked ingredient request ID (if applicable)" })
        ingredientRequestId?: string

    @Field(() => String, { nullable: true, description: "Linked operation request ID (if applicable)" })
        operationRequestId?: string

    @Field(() => String, { description: "Fundraiser user ID who receives the money" })
        receiverId: string

    @Field(() => InflowTransactionType, {
        description: "Transaction type: INGREDIENT, COOKING, or DELIVERY",
    })
        transactionType: InflowTransactionType

    @Field(() => String, {
        description: "Amount disbursed in VND (as string to handle BigInt)",
    })
        amount: string

    @Field(() => InflowTransactionStatus, {
        description: "Transaction status: PENDING, COMPLETED, or FAILED",
    })
        status: InflowTransactionStatus

    @Field(() => String, { description: "S3 URL of bank transfer screenshot proof" })
        proof: string

    @Field(() => Boolean, {
        description: "Whether this disbursement has been marked as reported",
    })
        isReported: boolean

    @Field(() => Date, {
        nullable: true,
        description: "When the transaction was marked as reported",
    })
        reportedAt?: Date

    @Field(() => User, {
        nullable: true,
        description: "Fundraiser who receives the disbursement",
    })
        receiver?: User

    @Field(() => CampaignPhase, {
        nullable: true,
        description: "Campaign phase this disbursement belongs to",
    })
        campaignPhase?: CampaignPhase
}
