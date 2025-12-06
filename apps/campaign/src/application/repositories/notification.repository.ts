import { Injectable } from "@nestjs/common"
import { Notification } from "../../domain/entities/notification.model"
import { PrismaClient } from "../../generated/campaign-client"
import { EntityType, NotificationType } from "../../domain/enums/notification"

export interface CreateNotificationData {
    userId: string
    actorId?: string
    type: NotificationType
    entityType: string
    entityId?: string
    data: Record<string, any>
}

export interface FindNotificationsOptions {
    userId: string
    limit?: number
    cursor?: string
    isRead?: boolean
}

export interface NotificationCursorPage {
    items: Notification[]
    hasMore: boolean
    nextCursor?: string
}

@Injectable()
export class NotificationRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createNotification(
        data: CreateNotificationData,
    ): Promise<Notification | null> {
        const notification = await this.prisma.notification.create({
            data: {
                user_id: data.userId,
                actor_id: data.actorId,
                type: data.type as any,
                entity_type: data.entityType as any,
                entity_id: data.entityId,
                data: data.data as any,
                is_read: false,
            },
        })

        return this.mapToGraphQLModel(notification)
    }

    async findNotifications(
        options: FindNotificationsOptions,
    ): Promise<NotificationCursorPage> {
        const { userId, limit = 20, cursor, isRead } = options

        const whereClause: any = {
            user_id: userId,
        }

        if (isRead !== undefined) {
            whereClause.is_read = isRead
        }

        if (cursor) {
            whereClause.created_at = {
                lt: new Date(cursor),
            }
        }

        const notifications = await this.prisma.notification.findMany({
            where: whereClause,
            orderBy: { created_at: "desc" },
            take: limit + 1,
        })

        const hasMore = notifications.length > limit
        const items = hasMore ? notifications.slice(0, limit) : notifications
        const lastItem = items.at(-1)
        const nextCursor =
            hasMore && lastItem ? lastItem.created_at.toISOString() : undefined

        return {
            items: items.map((n) => this.mapToGraphQLModel(n)),
            hasMore,
            nextCursor,
        }
    }

    async updateNotificationData(
        notificationId: string,
        data: Record<string, any>,
    ): Promise<Notification | null> {
        const existing = await this.prisma.notification.findFirst({
            where: { id: notificationId },
            select: { id: true, created_at: true },
        })

        if (!existing) {
            return null
        }

        const notification = await this.prisma.notification.update({
            where: {
                id_created_at: {
                    id: existing.id,
                    created_at: existing.created_at,
                },
            },
            data: {
                data: data as any,
                updated_at: new Date(),
            },
        })

        return this.mapToGraphQLModel(notification)
    }

    async markAsRead(notificationId: string, userId: string): Promise<boolean> {
        const result = await this.prisma.notification.updateMany({
            where: {
                id: notificationId,
                user_id: userId,
            },
            data: {
                is_read: true,
                updated_at: new Date(),
            },
        })

        return result.count > 0
    }

    async markManyAsRead(
        notificationIds: string[],
        userId: string,
    ): Promise<number> {
        const result = await this.prisma.notification.updateMany({
            where: {
                id: { in: notificationIds },
                user_id: userId,
            },
            data: {
                is_read: true,
                updated_at: new Date(),
            },
        })

        return result.count
    }

    async markAllAsRead(userId: string): Promise<number> {
        const result = await this.prisma.notification.updateMany({
            where: {
                user_id: userId,
                is_read: false,
            },
            data: {
                is_read: true,
                updated_at: new Date(),
            },
        })

        return result.count
    }

    async getUnreadCount(userId: string): Promise<number> {
        return await this.prisma.notification.count({
            where: {
                user_id: userId,
                is_read: false,
            },
        })
    }

    async findNotificationById(id: string): Promise<Notification | null> {
        const notification = await this.prisma.notification.findFirst({
            where: { id },
        })

        return notification ? this.mapToGraphQLModel(notification) : null
    }

    async deleteNotification(
        notificationId: string,
        userId: string,
    ): Promise<boolean> {
        const existing = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                user_id: userId,
            },
            select: { id: true, created_at: true },
        })

        if (!existing) {
            return false
        }

        await this.prisma.notification.delete({
            where: {
                id_created_at: {
                    id: existing.id,
                    created_at: existing.created_at,
                },
            },
        })

        return true
    }

    async deleteNotificationByEntityId(
        entityId: string,
        userId: string,
        type: NotificationType,
    ): Promise<boolean> {
        const existing = await this.prisma.notification.findFirst({
            where: {
                user_id: userId,
                entity_id: entityId,
                type: type as any,
                is_read: false,
            },
            select: { id: true, created_at: true, is_read: true },
        })

        if (!existing) {
            return false
        }

        await this.prisma.notification.delete({
            where: {
                id_created_at: {
                    id: existing.id,
                    created_at: existing.created_at,
                },
            },
        })

        return true
    }

    private mapToGraphQLModel(dbNotification: any): Notification {
        const notification = new Notification()
        notification.id = dbNotification.id
        notification.userId = dbNotification.user_id
        notification.actorId = dbNotification.actor_id
        notification.type = dbNotification.type as NotificationType
        notification.entityType = dbNotification.entity_type as EntityType
        notification.entityId = dbNotification.entity_id
        notification.data = dbNotification.data as Record<string, any>
        notification.isRead = dbNotification.is_read
        notification.created_at = dbNotification.created_at
        notification.updated_at = dbNotification.updated_at
        return notification
    }
}
