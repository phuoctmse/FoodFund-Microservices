import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType({
    isAbstract: true,
    description: "Abstract base schema with common fields",
})
export abstract class AbstractSchema {
    @Field(() => String, {
        description: "Unique identifier",
    })
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
