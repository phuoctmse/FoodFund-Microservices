import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
export class PaginatedNotificationResponse {
    @Field(() => [Notification], {
        description: "List of notifications",
    })
        notifications: Notification[]

    @Field(() => Boolean, {
        description: "Whether there are more notifications",
    })
        hasMore: boolean

    @Field(() => String, {
        nullable: true,
        description: "Cursor for next page",
    })
        nextCursor?: string
}

@ObjectType()
export class MarkAsReadResponse {
    @Field(() => Boolean, {
        description: "Whether operation was successful",
    })
        success: boolean

    @Field(() => Notification, {
        nullable: true,
        description: "Updated notification",
    })
        notification?: Notification

    @Field(() => String, {
        description: "Response message",
    })
        message: string
}

@ObjectType()
export class MarkAllAsReadResponse {
    @Field(() => Boolean, {
        description: "Whether operation was successful",
    })
        success: boolean

    @Field(() => Int, {
        description: "Number of notifications marked as read",
    })
        count: number

    @Field(() => String, {
        description: "Response message",
    })
        message: string
}

@ObjectType()
export class DeleteNotificationResponse {
    @Field(() => Boolean, {
        description: "Whether operation was successful",
    })
        success: boolean

    @Field(() => String, {
        description: "Response message",
    })
        message: string
}