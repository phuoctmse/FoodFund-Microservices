import {
    DeleteNotificationResponse,
    MarkAllAsReadResponse,
    MarkAsReadResponse,
} from "@app/campaign/src/application/dtos/notification/response/notification.response"
import { NotificationService } from "@app/campaign/src/application/services/notification"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import { CognitoGraphQLGuard, CurrentUser } from "@app/campaign/src/shared"
import { UseGuards } from "@nestjs/common"
import { Args, Mutation, Resolver } from "@nestjs/graphql"

@Resolver(() => Notification)
export class NotificationMutationResolver {
    constructor(private readonly notificationService: NotificationService) {}

    @Mutation(() => MarkAsReadResponse, {
        name: "markNotificationAsRead",
        description: "Mark a notification as read",
    })
    @UseGuards(CognitoGraphQLGuard)
    async markAsRead(
        @CurrentUser() user: any,
        @Args("notificationId", { type: () => String }) notificationId: string,
    ): Promise<MarkAsReadResponse> {
        const notification = await this.notificationService.markAsRead(
            notificationId,
            user.userId,
        )

        return {
            success: true,
            notification,
            message: "Notification marked as read successfully",
        }
    }

    @Mutation(() => MarkAllAsReadResponse, {
        name: "markAllNotificationsAsRead",
        description: "Mark all notifications as read for current user",
    })
    @UseGuards(CognitoGraphQLGuard)
    async markAllAsRead(
        @CurrentUser() user: any,
    ): Promise<MarkAllAsReadResponse> {
        const count = await this.notificationService.markAllAsRead(user.userId)

        return {
            success: true,
            count,
            message: `${count} notifications marked as read`,
        }
    }

    @Mutation(() => DeleteNotificationResponse, {
        name: "deleteNotification",
        description: "Delete a notification",
    })
    @UseGuards(CognitoGraphQLGuard)
    async deleteNotification(
        @CurrentUser() user: any,
        @Args("notificationId", { type: () => String }) notificationId: string,
    ): Promise<DeleteNotificationResponse> {
        await this.notificationService.deleteNotification(
            notificationId,
            user.userId,
        )

        return {
            success: true,
            message: "Notification deleted successfully",
        }
    }
}
