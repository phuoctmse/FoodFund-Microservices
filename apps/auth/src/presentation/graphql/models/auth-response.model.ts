import { ObjectType, Field } from "@nestjs/graphql"
import { AuthUser } from "./auth-user.model"

@ObjectType()
export class AuthResponse {
	@Field(() => AuthUser)
	    user: AuthUser

	@Field()
	    message: string
}
