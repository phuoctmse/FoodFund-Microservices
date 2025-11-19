import { NotificationPriority, NotificationType } from "../../enums/notification"

export interface NotificationJob {
    eventId: string
    priority: NotificationPriority
    type: NotificationType
    userId: string
    actorId?: string
    entityType: string
    entityId?: string
    data: Record<string, any>
    timestamp: string
    delaySeconds?: number
}