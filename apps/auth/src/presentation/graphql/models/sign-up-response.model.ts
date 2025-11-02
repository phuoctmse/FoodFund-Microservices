import { ObjectType, Field } from "@nestjs/graphql"

/**
 * Presentation Model: Sign Up Response
 */
@ObjectType()
export class SignUpResponse {
    @Field()
        userSub: string

    @Field()
        message: string

    @Field()
        emailSent: boolean
}
