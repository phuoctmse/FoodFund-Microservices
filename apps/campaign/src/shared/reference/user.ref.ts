import { Directive, Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType("User")
@Directive("@key(fields: \"id\")")
export class UserRef {
    @Field(() => ID)
        id: string

    __typename?: string
}
