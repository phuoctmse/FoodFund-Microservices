import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class CancelOrganizationRequestResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        cancelledOrganizationId?: string

    @Field(() => String, { nullable: true })
        previousStatus?: string

    @Field(() => String, { nullable: true })
        reason?: string
}
