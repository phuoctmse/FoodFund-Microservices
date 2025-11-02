import { InputType, Field } from "@nestjs/graphql"
import { IsEmail, IsNotEmpty, MinLength } from "class-validator"

/**
 * Presentation Input: Sign In
 * GraphQL input type for sign in mutation
 */
@InputType()
export class SignInInput {
    @Field()
    @IsEmail()
        email: string

    @Field()
    @IsNotEmpty()
    @MinLength(8)
        password: string
}
