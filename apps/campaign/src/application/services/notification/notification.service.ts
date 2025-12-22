import {
    EntityType,
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
    >(input: CreateNotificationInput<T>): Promise<Notification> {
        await this.validateEventProcessing(input)
        await this.validateDebouncing(input)
        const finalNotificationData = this.buildNotificationData(input)
        const notification = await this.saveNotification(
            input,
            finalNotificationData,
        )
        await this.handlePostCreation(input, notification)
        return notification
    }

    private async validateEventProcessing<
        T extends NotificationType & keyof NotificationDataMap,
    >(input: CreateNotificationInput<T>): Promise<void> {
        if (!input.eventId) {
            return
        }

        const isProcessed = await this.cacheService.isEventProcessed(
            input.eventId,
        )
        if (!isProcessed) {
            return
        }

        if (input.type === NotificationType.POST_LIKE && input.entityId) {
            throw new DuplicateEventError("UPDATE_EXISTING", input)
        }

        throw new Error("Event already processed")
    }

    private async validateDebouncing<
        T extends NotificationType & keyof NotificationDataMap,
    >(input: CreateNotificationInput<T>): Promise<void> {
        const shouldDebounce =
            input.priority === NotificationPriority.LOW &&
            input.type === NotificationType.POST_LIKE &&
            input.entityId

        if (!shouldDebounce) {
            return
        }

        const isDebounced = await this.cacheService.isDebounced(
            input.entityId!,
            input.userId,
        )

        if (isDebounced) {
            throw new Error("Notification debounced")
        }
    }

    private buildNotificationData<
        T extends NotificationType & keyof NotificationDataMap,
    >(input: CreateNotificationInput<T>): Record<string, any> {
        const hasPrebuiltContent = this.hasPrebuiltContent(input.data)

        if (hasPrebuiltContent) {
            return input.data as Record<string, any>
        }

        const content = this.notificationBuilder.build({
            type: input.type,
            data: input.data as any,
            userId: input.userId,
            actorId: input.actorId,
            entityId: input.entityId,
            metadata: input.metadata || {},
        })

        return {
            ...input.data,
            title: content.title,
            message: content.message,
            ...content.metadata,
            ...input.metadata,
        }
    }

    private hasPrebuiltContent(data: any): boolean {
        return (
            data &&
            typeof data === "object" &&
            "title" in data &&
            "message" in data &&
            data.title !== undefined &&
            data.message !== undefined
        )
    }

    private async saveNotification<
        T extends NotificationType & keyof NotificationDataMap,
    >(
        input: CreateNotificationInput<T>,
        finalNotificationData: Record<string, any>,
    ): Promise<Notification> {
        const notification =
            await this.notificationRepository.createNotification({
                userId: input.userId,
                actorId: input.actorId,
                type: input.type,
                entityType: this.getEntityTypeFromNotificationType(input.type),
                entityId: input.entityId,
                data: finalNotificationData,
            })

        if (!notification) {
            throw new Error("Failed to create notification")
        }

        return notification
    }

    private async handlePostCreation<
        T extends NotificationType & keyof NotificationDataMap,
    >(
        input: CreateNotificationInput<T>,
        notification: Notification,
    ): Promise<void> {
        await this.cacheService.incrementUnreadCount(input.userId)
        await this.cacheService.invalidateNotificationList(input.userId)

        if (input.eventId) {
            await this.cacheService.markEventAsProcessed(input.eventId)
        }

        const shouldSetDebounce =
            input.priority === NotificationPriority.LOW &&
            input.type === NotificationType.POST_LIKE &&
            input.entityId

        if (shouldSetDebounce) {
            await this.cacheService.setDebounce(input.entityId!, input.userId)
        }
    }

    async createBulkNotifications<
        T extends NotificationType & keyof NotificationDataMap,
    >(inputs: CreateNotificationInput<T>[]): Promise<Notification[]> {
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

        const freshCount =
            await this.notificationRepository.getUnreadCount(userId)
        await this.cacheService.setUnreadCount(userId, freshCount)
    }

    private getEntityTypeFromNotificationType(type: NotificationType): string {
        const typeMap: Record<NotificationType, string> = {
            [NotificationType.CAMPAIGN_APPROVED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_REJECTED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_COMPLETED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_CANCELLED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_DONATION_RECEIVED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_EXTENDED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_NEW_POST]: EntityType.POST,
            [NotificationType.POST_LIKE]: EntityType.POST,
            [NotificationType.POST_COMMENT]: EntityType.COMMENT,
            [NotificationType.POST_REPLY]: EntityType.COMMENT,
            [NotificationType.INGREDIENT_REQUEST_APPROVED]: EntityType.INGREDIENT_REQUEST,
            [NotificationType.INGREDIENT_REQUEST_REJECTED]: EntityType.INGREDIENT_REQUEST,
            [NotificationType.COOKING_REQUEST_APPROVED]: EntityType.OPERATION_REQUEST,
            [NotificationType.COOKING_REQUEST_REJECTED]: EntityType.OPERATION_REQUEST,
            [NotificationType.DELIVERY_REQUEST_APPROVED]: EntityType.OPERATION_REQUEST,
            [NotificationType.DELIVERY_REQUEST_REJECTED]: EntityType.OPERATION_REQUEST,
            [NotificationType.EXPENSE_PROOF_APPROVED]: EntityType.EXPENSE_PROOF,
            [NotificationType.EXPENSE_PROOF_REJECTED]: EntityType.EXPENSE_PROOF,
            [NotificationType.DELIVERY_TASK_ASSIGNED]: EntityType.DELIVERY_TASK,
            [NotificationType.CAMPAIGN_REASSIGNMENT_PENDING]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_REASSIGNMENT_ACCEPTED_ADMIN]: EntityType.CAMPAIGN,
            [NotificationType.CAMPAIGN_REASSIGNMENT_REJECTED_ADMIN]: EntityType.CAMPAIGN,
            [NotificationType.INGREDIENT_DISBURSEMENT_COMPLETED]: EntityType.CAMPAIGN,
            [NotificationType.COOKING_DISBURSEMENT_COMPLETED]: EntityType.CAMPAIGN,
            [NotificationType.DELIVERY_DISBURSEMENT_COMPLETED]: EntityType.CAMPAIGN,
            [NotificationType.SYSTEM_ANNOUNCEMENT]: EntityType.SYSTEM,
            [NotificationType.SURPLUS_TRANSFERRED]: EntityType.WALLET,
        }
        return typeMap[type] || "UNKNOWN"
    }
}

class DuplicateEventError extends Error {
    constructor(
        public readonly action: "UPDATE_EXISTING",
        public readonly input: any,
    ) {
        super("Duplicate event - needs special handling")
        this.name = "DuplicateEventError"
    }
}
