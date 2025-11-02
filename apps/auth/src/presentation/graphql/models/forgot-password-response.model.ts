import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class ForgotPasswordResponse {
	@Field()
	    emailSent: boolean

	@Field()
	    message: string
}
