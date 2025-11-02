import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class ResetPasswordResponse {
	@Field()
	    passwordReset: boolean

	@Field()
	    message: string
}
