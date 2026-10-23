import { ObjectType, Field, ID } from "@nestjs/graphql"

@ObjectType({
    isAbstract: true,
})
export abstract class BaseSchema {
    @Field(() => ID)
        id: string

    @Field(() => Date)
        created_at: Date

    @Field(() => Date)
        updated_at: Date
}
