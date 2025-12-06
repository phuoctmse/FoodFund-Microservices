import { RedisService } from "@libs/redis"
import { Injectable } from "@nestjs/common"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { NOTIFICATION_REDIS_KEYS } from "@app/campaign/src/domain/interfaces/notification"

@Injectable()
export class NotificationCacheService {
    constructor(private readonly redis: RedisService) {}

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

    async invalidateAllUserCaches(userId: string): Promise<void> {
        await Promise.all([
            this.invalidateUnreadCount(userId),
            this.invalidateNotificationList(userId),
        ])
    }
}
