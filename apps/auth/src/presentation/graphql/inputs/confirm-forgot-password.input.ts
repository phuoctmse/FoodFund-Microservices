import { InputType, Field } from "@nestjs/graphql"
import { IsEmail, IsNotEmpty, Matches, MinLength } from "class-validator"
import { Transform } from "class-transformer"

@InputType()
export class ConfirmForgotPasswordInput {
	@Field()
	@IsEmail({}, { message: "Please provide a valid email address" })
	@Transform(({ value }) => value?.toLowerCase().trim())
	    email: string

	@Field()
	@IsNotEmpty({ message: "Confirmation code is required" })
	@Matches(/^\d{6}$/, { message: "Confirmation code must be 6 digits" })
	    confirmationCode: string

	@Field()
	@IsNotEmpty({ message: "New password is required" })
	@MinLength(8, { message: "Password must be at least 8 characters" })
	    newPassword: string
}
