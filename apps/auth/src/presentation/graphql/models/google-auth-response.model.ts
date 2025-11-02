import { ObjectType, Field } from "@nestjs/graphql"
import { AuthUser } from "./auth-user.model"

@ObjectType()
export class GoogleAuthResponse {
	@Field(() => AuthUser)
	    user: AuthUser

	@Field()
	    accessToken: string

	@Field()
	    refreshToken: string

	@Field()
	    idToken: string

	@Field()
	    isNewUser: boolean

	@Field()
	    message: string
}
