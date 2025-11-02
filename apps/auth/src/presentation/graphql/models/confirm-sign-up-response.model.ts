import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class ConfirmSignUpResponse {
	@Field()
	    confirmed: boolean

	@Field()
	    message: string
}
