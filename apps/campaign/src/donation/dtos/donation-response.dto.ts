import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class DonationResponse {
    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        donationId?: string
}