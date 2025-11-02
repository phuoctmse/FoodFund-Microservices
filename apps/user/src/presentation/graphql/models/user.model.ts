import { ObjectType, Field, Directive, ID } from "@nestjs/graphql"
import { Role } from "../../../domain/enums"

/**
 * GraphQL Model: User
 * Represents user data in GraphQL schema
 */
@ObjectType("User")
@Directive("@key(fields: \"id\")")
export class UserModel {
    @Field(() => ID)
        id: string

    @Field(() => String)
        cognitoId: string

    @Field(() => String)
        fullName: string

    @Field(() => String)
        email: string

    @Field(() => String)
        username: string

    @Field(() => String, { nullable: true })
        avatarUrl?: string

    @Field(() => String, { nullable: true })
        phoneNumber?: string

    @Field(() => String, { nullable: true })
        address?: string

    @Field(() => String, { nullable: true })
        bio?: string

    @Field(() => Role)
        role: Role

    @Field(() => Boolean)
        isActive: boolean

    @Field(() => Date)
        createdAt: Date

    @Field(() => Date)
        updatedAt: Date

    @Field(() => Date, { nullable: true })
        deletedAt?: Date
}
