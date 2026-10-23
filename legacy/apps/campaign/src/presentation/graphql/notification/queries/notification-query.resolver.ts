import { NotificationFilters } from "@app/campaign/src/application/dtos/notification/request"
import { PaginatedNotificationResponse } from "@app/campaign/src/application/dtos/notification/response/notification.response"
import { NotificationService } from "@app/campaign/src/application/services/notification"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Int, Query, Resolver } from "@nestjs/graphql"

@Resolver(() => Notification)
export class NotificationQueryResolver {
    constructor(private readonly notificationService: NotificationService) {}

    @Query(() => PaginatedNotificationResponse, {
        name: "myNotifications",
        description:
            "Get current user's notifications with cursor-based pagination",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getMyNotifications(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("limit", { type: () => Int, nullable: true, defaultValue: 20 })
            limit: number,
        @Args("cursor", { type: () => String, nullable: true })
            cursor?: string,
        @Args("isRead", { type: () => Boolean, nullable: true })
            isRead?: boolean,
    ): Promise<PaginatedNotificationResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const filters: NotificationFilters = {
            limit,
            cursor,
            isRead,
        }

        const result = await this.notificationService.getNotifications(
            userContext.userId,
            filters,
        )

        return {
            notifications: result.notifications,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        }
    }

    @Query(() => Notification, {
        name: "notification",
        description: "Get a single notification by ID",
        nullable: true,
    })
    @UseGuards(CognitoGraphQLGuard)
    async getNotification(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("id", { type: () => String }) id: string,
    ): Promise<Notification | null> {
        const userContext = createUserContextFromToken(decodedToken)
        return await this.notificationService.getNotificationById(
            id,
            userContext,
        )
    }

    @Query(() => Int, {
        name: "unreadNotificationCount",
        description: "Get count of unread notifications for current user",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getUnreadCount(@CurrentUser() user: any): Promise<number> {
        const userContext = createUserContextFromToken(user)
        return await this.notificationService.getUnreadCount(userContext.userId)
    }

    @Query(() => PaginatedNotificationResponse, {
        name: "unreadNotifications",
        description: "Get only unread notifications for current user",
    })
    @UseGuards(CognitoGraphQLGuard)
    async getUnreadNotifications(
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("limit", { type: () => Int, nullable: true, defaultValue: 20 })
            limit: number,
        @Args("cursor", { type: () => String, nullable: true })
            cursor?: string,
    ): Promise<PaginatedNotificationResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const filters: NotificationFilters = {
            limit,
            cursor,
            isRead: false,
        }

        const result = await this.notificationService.getNotifications(
            userContext.userId,
            filters,
        )

        return {
            notifications: result.notifications,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor,
        }
    }
}
