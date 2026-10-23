import { NotificationPriority, NotificationType } from "../../enums/notification"

export interface GroupedNotificationJob {
    eventIds: string[]
    priority: NotificationPriority
    type: NotificationType
    userIds: string[]
    actorId?: string
    entityType: string
    entityId: string
    data: Record<string, any>
    timestamp: string
}