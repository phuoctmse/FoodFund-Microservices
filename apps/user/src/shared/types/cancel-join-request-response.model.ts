import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class CancelJoinRequestResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String, { nullable: true })
        cancelledRequestId?: string
}
