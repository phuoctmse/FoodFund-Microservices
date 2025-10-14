import { ObjectType, Field, Directive } from "@nestjs/graphql"
import { Role } from "../enums/user.enum"
import { AbstractSchema } from "../shared/base.schema"

@ObjectType("User")
@Directive("@key(fields: \"id\")")
export class UserProfileSchema extends AbstractSchema {
    @Field(() => String, {
        description: "User's full name",
    })
        full_name: string

    @Field(() => String, {
        description: "User email address",
    })
        email: string

    @Field(() => String, {
        description: "User's avatar URL",
        nullable: true,
    })
        avatar_url?: string

    @Field(() => String, {
        description: "User's address",
        nullable: true,
    })
        address?: string

    @Field(() => String, {
        description: "Unique username",
    })
        user_name: string

    @Field(() => Boolean, {
        description: "Whether the user is active",
        defaultValue: true,
    })
        is_active: boolean

    @Field(() => Role, {
        description: "User's role in the system",
    })
        role: Role

    @Field(() => String, {
        description: "User's phone number",
        nullable: true,
    })
        phone_number?: string

    @Field(() => String, {
        nullable: true,
        description: "User's bio/description",
    })
        bio?: string

    __typename?: string

    constructor() {
        super()
    }
}
