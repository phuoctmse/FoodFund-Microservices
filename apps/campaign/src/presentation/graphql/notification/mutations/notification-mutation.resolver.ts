import {
    DeleteNotificationResponse,
    MarkAllAsReadResponse,
    MarkAsReadResponse,
} from "@app/campaign/src/application/dtos/notification/response/notification.response"
import { NotificationService } from "@app/campaign/src/application/services/notification"
import { Notification } from "@app/campaign/src/domain/entities/notification.model"
import {
    CognitoGraphQLGuard,
    createUserContextFromToken,
    CurrentUser,
} from "@app/campaign/src/shared"
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
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("notificationId", { type: () => String }) notificationId: string,
    ): Promise<MarkAsReadResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const notification = await this.notificationService.markAsRead(
            notificationId,
            userContext,
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
        @CurrentUser("decodedToken") decodedToken: any,
    ): Promise<MarkAllAsReadResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        const count = await this.notificationService.markAllAsRead(
            userContext.userId,
        )

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
        @CurrentUser("decodedToken") decodedToken: any,
        @Args("notificationId", { type: () => String }) notificationId: string,
    ): Promise<DeleteNotificationResponse> {
        const userContext = createUserContextFromToken(decodedToken)
        await this.notificationService.deleteNotification(
            notificationId,
            userContext,
        )

        return {
            success: true,
            message: "Notification deleted successfully",
        }
    }
}
