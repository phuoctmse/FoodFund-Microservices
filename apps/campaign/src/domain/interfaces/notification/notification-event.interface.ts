import { EntityType, NotificationType } from "@app/campaign/src/domain/enums/notification"

/**
 * Base SQS event payload for notifications
 */
export interface NotificationEvent {
    eventId: string // Unique business event ID (not SQS MessageId!)
    priority: "HIGH" | "MEDIUM" | "LOW"
    type: NotificationType
    userId: string // Receiver
    actorId?: string // Who triggered the action
    entityType: EntityType
    entityId?: string
    data: Record<string, any> // Contains title, message, metadata
    timestamp: string // ISO timestamp
    delaySeconds?: number // For debouncing (Low priority)
}

/**
 * SQS Queue names (FIFO queues)
 */
export const NOTIFICATION_QUEUES = {
    HIGH_PRIORITY: "foodfund-notifications-high.fifo",
    MEDIUM_PRIORITY: "foodfund-notifications-medium.fifo",
    LOW_PRIORITY: "foodfund-notifications-low.fifo",
    DLQ: "foodfund-notifications-dlq.fifo",
} as const

export type NotificationQueueName = keyof typeof NOTIFICATION_QUEUES

/**
 * Get queue name by priority
 */
export function getQueueNameByPriority(
    priority: "HIGH" | "MEDIUM" | "LOW",
): string {
    const queueMap = {
        HIGH: NOTIFICATION_QUEUES.HIGH_PRIORITY,
        MEDIUM: NOTIFICATION_QUEUES.MEDIUM_PRIORITY,
        LOW: NOTIFICATION_QUEUES.LOW_PRIORITY,
    }
    return queueMap[priority]
}

/**
 * Redis keys for deduplication
 */
export const NOTIFICATION_REDIS_KEYS = {
    /**
     * Processed event key (10 minutes TTL)
     * Format: processed_event:{eventId}
     */
    PROCESSED_EVENT: (eventId: string) => `processed_event:${eventId}`,

    /**
     * Debounce key for likes (10 seconds TTL)
     * Format: debounce:like:{postId}:{userId}
     */
    DEBOUNCE_LIKE: (postId: string, userId: string) =>
        `debounce:like:${postId}:${userId}`,

    /**
     * Unread count key (1 day TTL)
     * Format: unread_count:{userId}
     */
    UNREAD_COUNT: (userId: string) => `unread_count:${userId}`,

    /**
     * Notification list cache (5 minutes TTL)
     * Format: notifications:list:{userId}
     */
    NOTIFICATION_LIST: (userId: string) => `notifications:list:${userId}`,

    /**
     * User presence key (tracks online/offline)
     * Format: presence:{userId}
     */
    USER_PRESENCE: (userId: string) => `presence:${userId}`,
} as const

/**
 * Redis Pub/Sub channels
 */
export const NOTIFICATION_CHANNELS = {
    /**
     * New notification channel
     * Format: notification:new:{userId}
     */
    NEW_NOTIFICATION: (userId: string) => `notification:new:${userId}`,

    /**
     * Unread count update channel
     * Format: notification:unread:{userId}
     */
    UNREAD_COUNT: (userId: string) => `notification:unread:${userId}`,
} as const