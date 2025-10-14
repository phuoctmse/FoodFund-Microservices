import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { BaseSchema } from "../../shared/base/base.schema"

@ObjectType()
@Directive("@key(fields: \"id\")")
export class Donation extends BaseSchema {
    @Field(() => String, { description: "ID of user who made the donation" })
        donorId: string

    @Field(() => String, {
        description: "ID of campaign receiving the donation",
    })
        campaignId: string

    @Field(() => String, { description: "Donation amount as string (BigInt)" })
        amount: string

    @Field(() => String, {
        nullable: true,
        description: "Optional message from donor",
    })
        message?: string

    @Field(() => String, {
        nullable: true,
        description: "Payment reference/transaction ID",
    })
        paymentReference?: string

    @Field(() => Boolean, { description: "Whether donation is anonymous" })
        isAnonymous: boolean
}
