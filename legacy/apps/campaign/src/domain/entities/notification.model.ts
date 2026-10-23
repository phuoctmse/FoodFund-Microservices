import { Directive, Field, ObjectType } from "@nestjs/graphql"
import { GraphQLJSONObject } from "graphql-type-json"
import { BaseSchema } from "../../shared"
import { EntityType, NotificationType } from "../enums/notification"

@ObjectType("Notification")
@Directive("@key(fields: \"id\")")
export class Notification extends BaseSchema {
    @Field(() => String, {
        description: "User ID of notification receiver",
    })
        userId: string

    @Field(() => String, {
        nullable: true,
        description: "User ID of person who triggered the action",
    })
        actorId?: string

    @Field(() => NotificationType, {
        description: "Type of notification",
    })
        type: NotificationType

    @Field(() => EntityType, {
        description: "Type of entity this notification relates to",
    })
        entityType: EntityType

    @Field(() => String, {
        nullable: true,
        description: "ID of related entity (campaign, post, etc.)",
    })
        entityId?: string

    @Field(() => GraphQLJSONObject, {
        nullable: true,
        description: "Dynamic notification data (title, message, metadata)",
    })
        data?: Record<string, any>

    @Field(() => Boolean, {
        description: "Whether notification has been read",
        defaultValue: false,
    })
        isRead: boolean

    constructor() {
        super()
    }
}