import { ObjectType, Field, ID } from "@nestjs/graphql"
import { Role } from "./enums/user.enums"

@ObjectType({
    isAbstract: true,
    description: "Abstract base schema with common fields including user information",
})
export abstract class AbstractSchema {
    @Field(() => ID, {
        description: "Unique identifier",
    })
        id: string

    @Field(() => Date, {
        description: "Creation timestamp",
    })
        createdAt: Date

    @Field(() => Date, {
        description: "Last update timestamp",
    })
        updated_at: Date

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
}
