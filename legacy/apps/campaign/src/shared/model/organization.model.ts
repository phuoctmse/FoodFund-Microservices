import { Directive, Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType("Organization")
@Directive("@key(fields: \"id\")")
export class Organization {
    @Field(() => ID)
        id: string

    __typename?: string
}