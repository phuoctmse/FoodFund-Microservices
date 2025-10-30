import { Directive, Field, ObjectType, registerEnumType } from "@nestjs/graphql"
import { BaseSchema } from "../../shared/base/base.schema"

export enum DonationStatus {
    PENDING = "PENDING",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED",
}

registerEnumType(DonationStatus, {
    name: "DonationStatus",
    description: "Status of donation payment",
})

@ObjectType()
@Directive("@key(fields: \"id\")")
export class Donation extends BaseSchema {
    @Field(() => String, { description: "ID of user who made the donation" })
        donorId: string

    @Field(() => String, {
        nullable: true,
        description: "Name of donor (null if anonymous or not available)",
    })
        donorName?: string

    @Field(() => String, {
        description: "ID of campaign receiving the donation",
    })
        campaignId: string

    @Field(() => String, { description: "Donation amount as string (BigInt)" })
        amount: string

    @Field(() => Boolean, { description: "Whether donation is anonymous" })
        isAnonymous: boolean

    @Field(() => DonationStatus, {
        description: "Payment status of the donation",
    })
        status: DonationStatus

    @Field(() => String, {
        nullable: true,
        description: "Order code from payment gateway",
    })
        orderCode?: string

    @Field(() => Date, {
        nullable: true,
        description: "Transaction datetime from payment gateway",
    })
        transactionDatetime?: Date
}
