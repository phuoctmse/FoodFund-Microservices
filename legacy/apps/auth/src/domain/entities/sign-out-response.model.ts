import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class SignOutResponse {
    @Field()
        message: string

    @Field()
        success: boolean

    @Field()
        timestamp: string
}
