import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class CheckPasswordResponse {
	@Field()
	    isValid: boolean

	@Field()
	    message: string
}
