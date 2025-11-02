import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty } from "class-validator"

@InputType()
export class RefreshTokenInput {
	@Field()
	@IsNotEmpty({ message: "Refresh token is required" })
	    refreshToken: string

	@Field()
	@IsNotEmpty({ message: "User name is required" })
	    userName: string
}
