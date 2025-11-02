import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty } from "class-validator"

@InputType()
export class CheckCurrentPasswordInput {
	@Field()
	@IsNotEmpty({ message: "Current password is required" })
	    currentPassword: string
}
