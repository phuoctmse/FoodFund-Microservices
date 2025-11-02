import { ObjectType, Field, ID } from "@nestjs/graphql"

/**
 * Presentation Model: Auth User
 * GraphQL type for authenticated user
 */
@ObjectType()
export class AuthUser {
    @Field(() => ID)
        id: string

    @Field()
        email: string

    @Field()
        username: string

    @Field()
        name: string

    @Field()
        emailVerified: boolean

    @Field()
        provider: string

    @Field()
        createdAt: Date

    @Field()
        updatedAt: Date
}
