import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
export class Badge {
    @Field()
        id: string

    @Field()
        name: string

    @Field()
        description: string

    @Field()
        icon_url: string

    @Field(() => Int)
        sort_order: number

    @Field()
        is_active: boolean

    @Field()
        created_at: Date

    @Field()
        updated_at: Date
}

@ObjectType()
export class UserBadge {
    @Field()
        id: string

    @Field()
        user_id: string

    @Field()
        badge_id: string

    @Field(() => Badge)
        badge: Badge

    @Field()
        awarded_at: Date
}
