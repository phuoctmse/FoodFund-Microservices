import { registerEnumType } from "@nestjs/graphql"

export enum NotificationType {
    CAMPAIGN_APPROVED = "CAMPAIGN_APPROVED",
    CAMPAIGN_REJECTED = "CAMPAIGN_REJECTED",
    CAMPAIGN_COMPLETED = "CAMPAIGN_COMPLETED",
    CAMPAIGN_CANCELLED = "CAMPAIGN_CANCELLED",
    CAMPAIGN_DONATION_RECEIVED = "CAMPAIGN_DONATION_RECEIVED",
    CAMPAIGN_NEW_POST = "CAMPAIGN_NEW_POST",
    CAMPAIGN_REASSIGNMENT_PENDING = "CAMPAIGN_REASSIGNMENT_PENDING",
    CAMPAIGN_OWNERSHIP_TRANSFERRED = "CAMPAIGN_OWNERSHIP_TRANSFERRED",
    CAMPAIGN_OWNERSHIP_RECEIVED = "CAMPAIGN_OWNERSHIP_RECEIVED",
    CAMPAIGN_REASSIGNMENT_EXPIRED = "CAMPAIGN_REASSIGNMENT_EXPIRED",

    POST_COMMENT = "POST_COMMENT",
    POST_REPLY = "POST_REPLY",

    POST_LIKE = "POST_LIKE",

    INGREDIENT_REQUEST_APPROVED = "INGREDIENT_REQUEST_APPROVED",
    DELIVERY_TASK_ASSIGNED = "DELIVERY_TASK_ASSIGNED",
    SURPLUS_TRANSFERRED = "SURPLUS_TRANSFERRED",

    SYSTEM_ANNOUNCEMENT = "SYSTEM_ANNOUNCEMENT",
}

export enum EntityType {
    CAMPAIGN = "CAMPAIGN",
    POST = "POST",
    COMMENT = "COMMENT",
    DONATION = "DONATION",
    INGREDIENT_REQUEST = "INGREDIENT_REQUEST",
    DELIVERY_TASK = "DELIVERY_TASK",
}

export enum NotificationPriority {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW",
}

export enum NotificationStatus {
    UNREAD = "UNREAD",
    READ = "READ",
}

registerEnumType(NotificationType, {
    name: "NotificationType",
    description: "Types of notifications in FoodFund system",
    valuesMap: {
        CAMPAIGN_APPROVED: {
            description: "Campaign has been approved by admin",
        },
        CAMPAIGN_REJECTED: {
            description: "Campaign has been rejected by admin",
        },
        CAMPAIGN_COMPLETED: {
            description: "Campaign has been completed",
        },
        CAMPAIGN_CANCELLED: {
            description: "Campaign has been cancelled",
        },
        CAMPAIGN_DONATION_RECEIVED: {
            description: "Campaign received new donations (grouped)",
        },
        CAMPAIGN_NEW_POST: {
            description: "New post published in campaign",
        },
        POST_LIKE: {
            description: "Post received likes (grouped)",
        },
        POST_COMMENT: {
            description: "New comment on post",
        },
        POST_REPLY: {
            description: "Reply to comment",
        },
        INGREDIENT_REQUEST_APPROVED: {
            description: "Ingredient request has been approved",
        },
        DELIVERY_TASK_ASSIGNED: {
            description: "Delivery task assigned to staff",
        },
        SURPLUS_TRANSFERRED: {
            description: "Surplus funds transferred to fundraiser wallet",
        },
        SYSTEM_ANNOUNCEMENT: {
            description: "System-wide announcement",
        },
    },
})

registerEnumType(EntityType, {
    name: "EntityType",
    description: "Types of entities that trigger notifications",
    valuesMap: {
        CAMPAIGN: {
            description: "Campaign entity",
        },
        POST: {
            description: "Post entity",
        },
        COMMENT: {
            description: "Comment entity",
        },
        DONATION: {
            description: "Donation entity",
        },
        INGREDIENT_REQUEST: {
            description: "Ingredient request entity",
        },
        DELIVERY_TASK: {
            description: "Delivery task entity",
        },
    },
})

registerEnumType(NotificationPriority, {
    name: "NotificationPriority",
    description: "Priority levels for notifications",
    valuesMap: {
        HIGH: {
            description: "High priority - immediate delivery",
        },
        MEDIUM: {
            description: "Medium priority - standard delivery",
        },
        LOW: {
            description: "Low priority - may be debounced",
        },
    },
})

registerEnumType(NotificationStatus, {
    name: "NotificationStatus",
    description: "Read status of notifications",
    valuesMap: {
        UNREAD: {
            description: "Notification not yet read",
        },
        READ: {
            description: "Notification has been read",
        },
    },
})

export const NOTIFICATION_PRIORITY_MAP: Record<
    NotificationType,
    NotificationPriority
> = {
    // High priority
    [NotificationType.CAMPAIGN_APPROVED]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_REJECTED]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_COMPLETED]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_CANCELLED]: NotificationPriority.HIGH,
    [NotificationType.INGREDIENT_REQUEST_APPROVED]: NotificationPriority.HIGH,
    [NotificationType.DELIVERY_TASK_ASSIGNED]: NotificationPriority.HIGH,
    [NotificationType.SYSTEM_ANNOUNCEMENT]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_REASSIGNMENT_PENDING]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED]: NotificationPriority.HIGH,
    [NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED]:NotificationPriority.HIGH,
    [NotificationType.SURPLUS_TRANSFERRED]: NotificationPriority.HIGH,

    // Medium priority
    [NotificationType.CAMPAIGN_DONATION_RECEIVED]: NotificationPriority.MEDIUM,
    [NotificationType.CAMPAIGN_NEW_POST]: NotificationPriority.MEDIUM,
    [NotificationType.POST_COMMENT]: NotificationPriority.MEDIUM,
    [NotificationType.POST_REPLY]: NotificationPriority.MEDIUM,

    // Low priority
    [NotificationType.POST_LIKE]: NotificationPriority.LOW,
}

export const NOTIFICATION_DELAY_MAP: Partial<Record<NotificationType, number>> =
    {
        [NotificationType.POST_LIKE]: 10,
    }
