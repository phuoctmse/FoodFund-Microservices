import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class SystemConfig {
    @Field()
        key: string

    @Field()
        value: string

    @Field({ nullable: true })
        description?: string

    @Field()
        dataType: string

    @Field()
        updatedAt: Date
}
