import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class SignOutResponse {
	@Field()
	    success: boolean

	@Field()
	    message: string

	@Field()
	    timestamp: string
}
