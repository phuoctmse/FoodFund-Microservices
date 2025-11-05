import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class ChangePasswordResponse {
    @Field(() => Boolean)
        success: boolean

    @Field(() => String)
        message: string

    @Field(() => String)
        timestamp: string
}
