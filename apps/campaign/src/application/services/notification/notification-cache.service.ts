import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { NOTIFICATION_CHANNELS, NOTIFICATION_REDIS_KEYS } from "@app/campaign/src/domain/interfaces/notification"
import { PubSubService } from "@libs/pubsub"

@Injectable()
export class NotificationCacheService {
    constructor(
        private readonly redis: RedisService,
        private readonly pubSubService: PubSubService,
    ) {}

    async isEventProcessed(eventId: string): Promise<boolean> {
        const key = NOTIFICATION_REDIS_KEYS.PROCESSED_EVENT(eventId)
        const exists = await this.redis.exists(key)
        return exists === 1
    }

    async markEventAsProcessed(
        eventId: string,
        ttlSeconds: number = 600,
    ): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.PROCESSED_EVENT(eventId)
        await this.redis.setex(key, ttlSeconds, "1")
    }

    async isDebounced(postId: string, userId: string): Promise<boolean> {
        const key = NOTIFICATION_REDIS_KEYS.DEBOUNCE_LIKE(postId, userId)
        const exists = await this.redis.exists(key)
        return exists === 1
    }

    async setDebounce(
        postId: string,
        userId: string,
        ttlSeconds: number = 10,
    ): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.DEBOUNCE_LIKE(postId, userId)
        await this.redis.setex(key, ttlSeconds, "1")
    }

    async getUnreadCount(userId: string): Promise<number | null> {
        const key = NOTIFICATION_REDIS_KEYS.UNREAD_COUNT(userId)
        const count = await this.redis.get(key)
        return count ? Number.parseInt(count, 10) : null
    }

    async setUnreadCount(
        userId: string,
        count: number,
        ttlSeconds: number = 86400,
    ): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.UNREAD_COUNT(userId)
        await this.redis.setex(key, ttlSeconds, count.toString())
    }

    async incrementUnreadCount(userId: string, by: number = 1): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.UNREAD_COUNT(userId)
        await this.redis.incrby(key, by)
        await this.redis.expire(key, 86400)
    }

    async decrementUnreadCount(userId: string, by: number = 1): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.UNREAD_COUNT(userId)
        const newCount = await this.redis.decrby(key, by)

        if (newCount < 0) {
            await this.redis.set(key, "0")
        }

        await this.redis.expire(key, 86400)
    }

    async invalidateUnreadCount(userId: string): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.UNREAD_COUNT(userId)
        await this.redis.del(key)
    }

    async getNotificationList(userId: string): Promise<Notification[] | null> {
        const key = NOTIFICATION_REDIS_KEYS.NOTIFICATION_LIST(userId)
        const data = await this.redis.get(key)

        if (!data) return null

        return JSON.parse(data) as Notification[]
    }

    async setNotificationList(
        userId: string,
        notifications: Notification[],
        ttlSeconds: number = 300,
    ): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.NOTIFICATION_LIST(userId)
        await this.redis.setex(key, ttlSeconds, JSON.stringify(notifications))
    }

    async invalidateNotificationList(userId: string): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.NOTIFICATION_LIST(userId)
        await this.redis.del(key)
    }

    async setUserOnline(
        userId: string,
        ttlSeconds: number = 300,
    ): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.USER_PRESENCE(userId)
        await this.redis.setex(key, ttlSeconds, "online")
    }

    async isUserOnline(userId: string): Promise<boolean> {
        const key = NOTIFICATION_REDIS_KEYS.USER_PRESENCE(userId)
        const exists = await this.redis.exists(key)
        return exists === 1
    }

    async setUserOffline(userId: string): Promise<void> {
        const key = NOTIFICATION_REDIS_KEYS.USER_PRESENCE(userId)
        await this.redis.del(key)
    }

    async publishNewNotification(
        userId: string,
        notification: Notification,
    ): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.NEW_NOTIFICATION(userId)
        await this.pubSubService.publish(channel, notification)
    }

    async publishUnreadCountUpdate(
        userId: string,
        count: number,
    ): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.UNREAD_COUNT(userId)
        await this.pubSubService.publish(channel, { userId, count })
    }

    async subscribeToNotifications(
        userId: string,
        callback: (notification: Notification) => void,
    ): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.NEW_NOTIFICATION(userId)
        await this.redis.subscribe(channel, (message) => {
            const notification = JSON.parse(message) as Notification
            callback(notification)
        })
    }

    async subscribeToUnreadCount(
        userId: string,
        callback: (count: number) => void,
    ): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.UNREAD_COUNT(userId)
        await this.redis.subscribe(channel, (message) => {
            const count = Number.parseInt(message, 10)
            callback(count)
        })
    }

    async unsubscribeFromNotifications(userId: string): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.NEW_NOTIFICATION(userId)
        await this.redis.unsubscribe(channel)
    }

    async unsubscribeFromUnreadCount(userId: string): Promise<void> {
        const channel = NOTIFICATION_CHANNELS.UNREAD_COUNT(userId)
        await this.redis.unsubscribe(channel)
    }

    async invalidateAllUserCaches(userId: string): Promise<void> {
        await Promise.all([
            this.invalidateUnreadCount(userId),
            this.invalidateNotificationList(userId),
            this.setUserOffline(userId),
        ])
    }
}
