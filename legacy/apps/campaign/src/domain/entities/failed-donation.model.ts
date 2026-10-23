import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class FailedDonationModel {
    @Field(() => String)
        id: string

    @Field(() => String)
        orderCode: string

    @Field(() => String)
        amount: string

    @Field(() => String, { nullable: true })
        errorDescription?: string

    @Field(() => String, { nullable: true })
        customerName?: string

    @Field(() => String, { nullable: true })
        customerAccountNumber?: string

    @Field(() => String, { nullable: true })
        customerBankName?: string

    @Field(() => Date, { nullable: true })
        transactionDateTime?: Date

    @Field(() => String)
        campaignId: string

    @Field(() => String)
        campaignTitle: string

    @Field(() => Date)
        createdAt: Date
}

@ObjectType()
export class ApproveDonationResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String)
        donationId: string
}

@ObjectType()
export class DonationDetailsModel {
    @Field(() => String)
        id: string

    @Field(() => String)
        orderCode: string

    @Field(() => String)
        status: string

    @Field(() => String)
        expectedAmount: string

    @Field(() => String, { nullable: true })
        expectedDescription?: string

    @Field(() => String, { nullable: true })
        customerName?: string

    @Field(() => String, { nullable: true })
        customerAccountNumber?: string

    @Field(() => String, { nullable: true })
        customerBankName?: string

    @Field(() => String, { nullable: true })
        errorDescription?: string

    @Field(() => String, { nullable: true })
        reference?: string

    @Field(() => Date, { nullable: true })
        transactionDateTime?: Date

    @Field(() => String)
        donationId: string

    @Field(() => String)
        campaignId: string

    @Field(() => String)
        campaignTitle: string

    @Field(() => Date)
        createdAt: Date
}
