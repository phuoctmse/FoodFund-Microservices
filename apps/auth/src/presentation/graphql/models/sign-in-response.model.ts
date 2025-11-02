import { ObjectType, Field, Int } from "@nestjs/graphql"
import { AuthUser } from "./auth-user.model"

/**
 * Presentation Model: Sign In Response
 */
@ObjectType()
export class SignInResponse {
    @Field()
        accessToken: string

    @Field()
        refreshToken: string

    @Field()
        idToken: string

    @Field(() => Int)
        expiresIn: number

    @Field(() => AuthUser)
        user: AuthUser

    @Field()
        message: string
}
