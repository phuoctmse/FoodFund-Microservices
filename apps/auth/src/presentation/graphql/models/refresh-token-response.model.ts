import { ObjectType, Field, Int } from "@nestjs/graphql"

@ObjectType()
export class RefreshTokenResponse {
	@Field()
	    accessToken: string

	@Field()
	    idToken: string

	@Field(() => Int)
	    expiresIn: number

	@Field()
	    message: string
}
