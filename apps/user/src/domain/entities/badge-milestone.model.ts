import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
export class BadgeMilestone {
    @Field()
        name: string

    @Field()
        badgeId: string

    @Field()
        minAmount: string // BigInt as string for GraphQL

    @Field(() => Int)
        priority: number

    @Field({ nullable: true })
        description?: string
}
