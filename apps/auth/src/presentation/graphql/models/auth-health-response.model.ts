import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
export class AuthHealthResponse {
	@Field()
	    status: string

	@Field()
	    service: string

	@Field()
	    timestamp: string
}
