import { InputType, Field } from "@nestjs/graphql"
import { IsEmail, IsNotEmpty, MinLength } from "class-validator"

/**
 * Presentation Input: Sign Up
 * GraphQL input type for sign up mutation
 */
@InputType()
export class SignUpInput {
    @Field()
    @IsEmail()
        email: string

    @Field()
    @IsNotEmpty()
    @MinLength(8)
        password: string

    @Field()
    @IsNotEmpty()
        name: string
}
