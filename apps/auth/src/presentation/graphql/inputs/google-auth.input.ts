import { InputType, Field } from "@nestjs/graphql"
import { IsNotEmpty } from "class-validator"

@InputType()
export class GoogleAuthInput {
	@Field()
	@IsNotEmpty({ message: "Google ID token is required" })
	    idToken: string
}
