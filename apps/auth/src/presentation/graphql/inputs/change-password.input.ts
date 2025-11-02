import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty, MinLength } from "class-validator"

@InputType()
export class ChangePasswordInput {
	@Field()
	@IsNotEmpty({ message: "New password is required" })
	@MinLength(8, { message: "Password must be at least 8 characters" })
	    newPassword: string

	@Field()
	@IsNotEmpty({ message: "Confirm new password is required" })
	    confirmNewPassword: string
}
