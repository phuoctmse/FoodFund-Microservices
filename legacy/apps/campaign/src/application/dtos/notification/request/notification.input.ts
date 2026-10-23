import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator"
import {
    NotificationPriority,
    NotificationType,
} from "@app/campaign/src/domain/enums/notification"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { NotificationDataMap } from "@app/campaign/src/domain/interfaces/notification"

export interface CreateNotificationInput<
    T extends NotificationType & keyof NotificationDataMap,
> {
    userId: string
    type: T
    data: NotificationDataMap[T]
    priority?: NotificationPriority
    actorId?: string
    entityId?: string
    eventId?: string
    metadata?: Record<string, any>
}

@InputType()
export class NotificationFilters {
    @Field(() => Int, { nullable: true, defaultValue: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
        limit?: number

    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
        cursor?: string

    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
        isRead?: boolean
}

export interface PaginatedNotifications {
    notifications: Notification[]
    hasMore: boolean
    nextCursor?: string
}

@InputType()
export class MarkAsReadInput {
    @Field(() => String)
    @IsString()
        notificationId: string
}

@InputType()
export class MarkManyAsReadInput {
    @Field(() => [String])
        notificationIds: string[]
}
