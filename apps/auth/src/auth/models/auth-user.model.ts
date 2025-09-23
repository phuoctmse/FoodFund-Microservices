import { Directive, Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
@Directive("@key(fields: \"id\")")
export class AuthUser {
    @Field((type) => ID)
        id: string

    @Field()
        email: string

    @Field()
        username: string

    @Field()
        phoneNumber: string

    @Field()
        emailVerified: boolean    

    @Field()
        name: string

    @Field()
        provider: string

    @Field()
        createdAt: Date

    @Field()
        updatedAt: Date  
}
