import {
    NotificationPriority,
    NotificationType,
} from "@app/campaign/src/domain/enums/notification"
import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { NotificationBuilderFactory } from "../../builders/notification"
import { NotificationCacheService } from "./notification-cache.service"
import { NotificationRepository } from "../../repositories/notification.repository"
import {
    CreateNotificationInput,
    NotificationFilters,
    PaginatedNotifications,
} from "../../dtos/notification/request"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { UserContext } from "@app/campaign/src/shared"
import { NotificationDataMap } from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class NotificationService {
    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly notificationBuilder: NotificationBuilderFactory,
        private readonly cacheService: NotificationCacheService,
    ) {}

    async createNotification<
        T extends NotificationType & keyof NotificationDataMap,
    >(
        input: CreateNotificationInput<T>,
    ): Promise<Notification> {
        if (input.eventId) {
            const isProcessed = await this.cacheService.isEventProcessed(
                input.eventId,
            )
            if (isProcessed) {
                if (
                    input.type === NotificationType.POST_LIKE &&
                    input.entityId
                ) {
                    return await this.updateExistingLikeNotification(input)
                }
                throw new Error("Event already processed")
            }
        }

        if (
            input.priority === NotificationPriority.LOW &&
            input.type === NotificationType.POST_LIKE &&
            input.entityId
        ) {
            const isDebounced = await this.cacheService.isDebounced(
                input.entityId,
                input.userId,
            )
            if (isDebounced) {
                throw new Error("Notification debounced")
            }
        }

        const content = this.notificationBuilder.build({
            type: input.type,
            data: input.data,
            userId: input.userId,
            actorId: input.actorId,
            entityId: input.entityId,
            metadata: input.metadata,
        })

        const notificationData = {
            userId: input.userId,
            actorId: input.actorId,
            type: input.type,
            entityType: this.getEntityTypeFromNotificationType(input.type),
            entityId: input.entityId,
            data: {
                title: content.title,
                message: content.message,
                ...input.data,
                ...content.metadata,
                ...input.metadata,
            },
        }

        const savedNotification =
            await this.notificationRepository.createNotification(
                notificationData,
            )

        if (!savedNotification) {
            throw new Error("Failed to create notification in database")
        }

        await this.handleCacheAfterCreate(savedNotification, input)

        if (input.eventId) {
            await this.cacheService.markEventAsProcessed(input.eventId)
        }

        return savedNotification
    }

    async createBulkNotifications<
        T extends NotificationType & keyof NotificationDataMap,
    >(
        inputs: CreateNotificationInput<T>[],
    ): Promise<Notification[]> {
        const notifications: Notification[] = []

        for (const input of inputs) {
            const content = this.notificationBuilder.build({
                type: input.type,
                data: input.data,
                userId: input.userId,
                actorId: input.actorId,
                entityId: input.entityId,
                metadata: input.metadata,
            })

            const notificationData = {
                userId: input.userId,
                actorId: input.actorId,
                type: input.type,
                entityType: this.getEntityTypeFromNotificationType(input.type),
                entityId: input.entityId,
                data: {
                    ...input.data,
                    ...content.metadata,
                    ...input.metadata,
                },
            }

            const notification =
                await this.notificationRepository.createNotification(
                    notificationData,
                )

            if (notification) {
                notifications.push(notification)
            }
        }

        for (const notification of notifications) {
            await this.cacheService.incrementUnreadCount(notification.userId)
            await this.cacheService.invalidateNotificationList(
                notification.userId,
            )
        }

        return notifications
    }

    async getNotificationById(
        id: string,
        userContext: UserContext,
    ): Promise<Notification> {
        const notification =
            await this.notificationRepository.findNotificationById(id)

        if (!notification) {
            throw new NotFoundException(`Notification ${id} not found`)
        }

        if (notification.userId !== userContext.userId) {
            throw new ForbiddenException(
                "You can only view your own notification",
            )
        }

        return notification
    }

    async getNotifications(
        userId: string,
        filters: NotificationFilters,
    ): Promise<PaginatedNotifications> {
        if (!filters.isRead && filters.limit === 20 && !filters.cursor) {
            const cached = await this.cacheService.getNotificationList(userId)
            if (cached) {
                return {
                    notifications: cached,
                    hasMore: false,
                    nextCursor: undefined,
                }
            }
        }

        const result = await this.notificationRepository.findNotifications({
            userId,
            limit: filters.limit || 20,
            cursor: filters.cursor,
            isRead: filters.isRead,
        })

        if (!filters.isRead && filters.limit === 20 && !filters.cursor) {
            await this.cacheService.setNotificationList(
                userId,
                result.items,
                300,
            )
        }

        return {
            notifications: result.items,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        }
    }

    async getUnreadCount(userId: string): Promise<number> {
        const cached = await this.cacheService.getUnreadCount(userId)
        if (cached !== null) {
            return cached
        }

        const count = await this.notificationRepository.getUnreadCount(userId)

        await this.cacheService.setUnreadCount(userId, count)

        return count
    }

    async markAsRead(
        id: string,
        userContext: UserContext,
    ): Promise<Notification> {
        const notification = await this.getNotificationById(id, userContext)
        if (notification.userId !== userContext.userId) {
            throw new ForbiddenException("Unauthorized")
        }

        if (notification.isRead) {
            return notification
        }

        const success = await this.notificationRepository.markAsRead(
            id,
            userContext.userId,
        )

        if (!success) {
            throw new Error("Failed to mark notification as read")
        }

        await this.cacheService.decrementUnreadCount(userContext.userId)
        await this.cacheService.invalidateNotificationList(userContext.userId)

        const freshCount = await this.notificationRepository.getUnreadCount(
            userContext.userId,
        )
        await this.cacheService.setUnreadCount(userContext.userId, freshCount)

        return await this.getNotificationById(id, userContext)
    }

    async markAllAsRead(userId: string): Promise<number> {
        const count = await this.notificationRepository.markAllAsRead(userId)

        await this.cacheService.setUnreadCount(userId, 0)
        await this.cacheService.invalidateNotificationList(userId)

        return count
    }

    async deleteNotification(
        id: string,
        userContext: UserContext,
    ): Promise<void> {
        const notification = await this.getNotificationById(id, userContext)
        if (notification.userId !== userContext.userId) {
            throw new ForbiddenException(
                "Unauthorized to delete this notification",
            )
        }
        const deleted = await this.notificationRepository.deleteNotification(
            id,
            userContext.userId,
        )
        if (!deleted) {
            throw new Error("Failed to delete notification")
        }

        if (!notification.isRead) {
            await this.cacheService.decrementUnreadCount(userContext.userId)
        }
        await this.cacheService.invalidateNotificationList(userContext.userId)
        const freshCount = await this.notificationRepository.getUnreadCount(
            userContext.userId,
        )
        await this.cacheService.setUnreadCount(userContext.userId, freshCount)
    }

    async deleteNotificationByEntityId(
        entityId: string,
        userId: string,
    ): Promise<void> {
        const deleted =
            await this.notificationRepository.deleteNotificationByEntityId(
                entityId,
                userId,
                NotificationType.POST_LIKE,
            )

        if (!deleted) {
            return
        }

        await this.cacheService.decrementUnreadCount(userId)
        await this.cacheService.invalidateNotificationList(userId)

        const freshCount = await this.notificationRepository.getUnreadCount(userId)
        await this.cacheService.setUnreadCount(userId, freshCount)
    }

    private async updateExistingLikeNotification<
        T extends NotificationType & keyof NotificationDataMap,
    >(
        input: CreateNotificationInput<T>,
    ): Promise<Notification> {
        const existingNotifications =
            await this.notificationRepository.findNotifications({
                userId: input.userId,
                limit: 50,
                isRead: false,
            })

        const existingNotification = existingNotifications.items.find(
            (n) =>
                n.type === NotificationType.POST_LIKE &&
                n.entityId === input.entityId &&
                !n.isRead,
        )

        if (!existingNotification) {
            return await this.createNotification(input)
        }

        const content = this.notificationBuilder.build({
            type: input.type,
            data: input.data,
            userId: input.userId,
            actorId: input.actorId,
            entityId: input.entityId,
            metadata: input.metadata,
        })

        const updatedData = {
            title: content.title,
            message: content.message,
            ...input.data,
            ...content.metadata,
            ...input.metadata,
        }

        const updatedNotification =
            await this.notificationRepository.updateNotificationData(
                existingNotification.id,
                updatedData,
            )

        if (!updatedNotification) {
            throw new Error("Failed to update notification")
        }

        await this.cacheService.invalidateNotificationList(input.userId)

        return updatedNotification
    }

    private async handleCacheAfterCreate(
        notification: Notification,
        input: CreateNotificationInput<any>,
    ): Promise<void> {
        await this.cacheService.incrementUnreadCount(notification.userId)
        await this.cacheService.invalidateNotificationList(notification.userId)

        if (
            input.priority === NotificationPriority.LOW &&
            input.type === NotificationType.POST_LIKE &&
            input.entityId
        ) {
            await this.cacheService.setDebounce(
                input.entityId,
                notification.userId,
                10,
            )
        }
    }

    private getEntityTypeFromNotificationType(type: NotificationType): string {
        const typeMap: Record<NotificationType, string> = {
            [NotificationType.CAMPAIGN_APPROVED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_REJECTED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_COMPLETED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_CANCELLED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_DONATION_RECEIVED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_NEW_POST]: "POST",
            [NotificationType.POST_LIKE]: "POST",
            [NotificationType.POST_COMMENT]: "COMMENT",
            [NotificationType.POST_REPLY]: "COMMENT",
            [NotificationType.INGREDIENT_REQUEST_APPROVED]:
                "INGREDIENT_REQUEST",
            [NotificationType.DELIVERY_TASK_ASSIGNED]: "DELIVERY_TASK",
            [NotificationType.CAMPAIGN_REASSIGNMENT_PENDING]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED]: "CAMPAIGN",
            [NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED]: "CAMPAIGN",
            [NotificationType.SYSTEM_ANNOUNCEMENT]: "SYSTEM",
        }

        return typeMap[type] || "UNKNOWN"
    }
}
