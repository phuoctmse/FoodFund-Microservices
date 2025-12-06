import { ObjectType, Field, ID } from "@nestjs/graphql"

@ObjectType({
    isAbstract: true,
    description:
        "Abstract base schema with common fields including user information",
})
export abstract class AbstractSchema {
    @Field(() => ID)
        id: string

    @Field(() => Date, {
        description: "Creation timestamp",
    })
        created_at: Date

    @Field(() => Date, {
        description: "Last update timestamp",
    })
        updated_at: Date
}
