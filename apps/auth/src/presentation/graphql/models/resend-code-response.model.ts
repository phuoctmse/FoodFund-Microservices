import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class ResendCodeResponse {
	@Field()
	    emailSent: boolean

	@Field()
	    message: string
}
