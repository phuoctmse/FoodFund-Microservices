import { NotificationCacheService } from "@app/campaign/src/application/services/notification"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { NOTIFICATION_CHANNELS } from "@app/campaign/src/domain/interfaces/notification"
import { CognitoGraphQLGuard, CurrentUser } from "@app/campaign/src/shared"
import { PubSubService } from "@libs/pubsub"
import { UseGuards } from "@nestjs/common"
import { Resolver, Subscription } from "@nestjs/graphql"

@Resolver(() => Notification)
export class NotificationSubscriptionResolver {
    constructor(
        private readonly pubSubService: PubSubService,
        private readonly cacheService: NotificationCacheService,
    ) {}

    @Subscription(() => Notification, {
        name: "notificationReceived",
        description: "Subscribe to new notifications for current user",
        resolve: (payload) => payload,
        filter: (payload, variables, context) => {
            return payload.userId === context.user.userId
        },
    })
    @UseGuards(CognitoGraphQLGuard)
    async notificationReceived(@CurrentUser() user: any) {
        await this.cacheService.setUserOnline(user.userId, 300)

        const channel = NOTIFICATION_CHANNELS.NEW_NOTIFICATION(user.userId)

        return this.pubSubService.asyncIterator(channel)
    }

    @Subscription(() => Number, {
        name: "unreadCountUpdated",
        description: "Subscribe to unread notification count updates",
        resolve: (payload) => payload.count,
        filter: (payload, variables, context) => {
            return payload.userId === context.user.userId
        },
    })
    @UseGuards(CognitoGraphQLGuard)
    async unreadCountUpdated(@CurrentUser() user: any) {
        await this.cacheService.setUserOnline(user.userId, 300)

        const channel = NOTIFICATION_CHANNELS.UNREAD_COUNT(user.userId)

        return this.pubSubService.asyncIterator(channel)
    }
}