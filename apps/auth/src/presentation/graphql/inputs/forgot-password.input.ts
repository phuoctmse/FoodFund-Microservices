import { InputType, Field } from "@nestjs/graphql"
import { IsEmail } from "class-validator"
import { Transform } from "class-transformer"

@InputType()
export class ForgotPasswordInput {
	@Field()
	@IsEmail({}, { message: "Please provide a valid email address" })
	@Transform(({ value }) => value?.toLowerCase().trim())
	    email: string
}
