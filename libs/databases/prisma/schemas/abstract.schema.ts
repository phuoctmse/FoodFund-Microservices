import { ObjectType, Field, ID } from "@nestjs/graphql"

@ObjectType({
    isAbstract: true,
    description: "Abstract base schema with common fields",
})
export abstract class AbstractSchema {
    @Field(() => ID)
        id: string

    @Field(() => Date)
        createdAt: Date

    @Field(() => Date)
        updatedAt: Date
}
