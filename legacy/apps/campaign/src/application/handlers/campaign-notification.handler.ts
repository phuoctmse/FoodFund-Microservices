import { OnEvent } from "@nestjs/event-emitter"
import {
    EntityType,
    NotificationPriority,
    NotificationType,
} from "../../domain/enums/notification"
import { NotificationQueue } from "../workers/notification"
import { Injectable } from "@nestjs/common"
import {
    CampaignApprovedEvent,
    CampaignCancelledEvent,
    CampaignCompletedEvent,
    CampaignDonationReceivedEvent,
    CampaignExtendedEvent,
    CampaignNewPostEvent,
    CampaignPhaseStatusUpdatedEvent,
    CampaignRejectedEvent,
} from "../../domain/events"
import {
    CampaignReassignmentAcceptedAdminEvent,
    CampaignReassignmentApprovedEvent,
    CampaignReassignmentAssignedEvent,
    CampaignReassignmentExpiredEvent,
    CampaignReassignmentRejectedAdminEvent,
} from "../../domain/events/campaign-reassignment.event"
import { UserClientService } from "../../shared"

@Injectable()
export class CampaignNotificationHandler {
    constructor(
        private readonly notificationQueue: NotificationQueue,
        private readonly userClientService: UserClientService,
    ) {}

    @OnEvent("campaign.approved")
    async handleCampaignApproved(event: CampaignApprovedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `campaign-approved-${event.campaignId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_APPROVED,
            userId: event.fundraiserId,
            actorId: event.approvedBy,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                approvedBy: event.approvedBy,
                approvedAt: event.approvedAt,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.rejected")
    async handleCampaignRejected(event: CampaignRejectedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `campaign-rejected-${event.campaignId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_REJECTED,
            userId: event.fundraiserId,
            actorId: event.rejectedBy,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                rejectedBy: event.rejectedBy,
                reason: event.reason,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.completed")
    async handleCampaignCompleted(event: CampaignCompletedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `campaign-completed-${event.campaignId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_COMPLETED,
            userId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                totalRaised: event.totalRaised,
                totalDonors: event.totalDonors,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.cancelled")
    async handleCampaignCancelled(event: CampaignCancelledEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `campaign-cancelled-${event.campaignId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_CANCELLED,
            userId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                reason: event.reason,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.donation.received")
    async handleDonationReceived(event: CampaignDonationReceivedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `donation-received-${event.donationId}`,
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.CAMPAIGN_DONATION_RECEIVED,
            userId: event.fundraiserId,
            actorId: event.donorId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                donorCount: 1,
                totalAmount: event.amount,
            },
            timestamp: new Date().toISOString(),
            delaySeconds: 30,
        })
    }

    @OnEvent("campaign.post.created")
    async handleNewPost(event: CampaignNewPostEvent) {
        await this.notificationQueue.addGroupedNotificationJob({
            eventIds: [`post-created-${event.postId}`],
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.CAMPAIGN_NEW_POST,
            userIds: event.followerIds,
            actorId: event.authorId,
            entityType: EntityType.POST,
            entityId: event.postId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                postId: event.postId,
                postTitle: event.postTitle,
                postPreview: event.postPreview,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.reassignment.assigned")
    async handleReassignmentAssigned(event: CampaignReassignmentAssignedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `reassignment-assigned-${event.reassignmentId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_REASSIGNMENT_PENDING,
            userId: event.fundraiserId,
            actorId: event.assignedBy,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                organizationName: event.organizationName,
                expiresAt: event.expiresAt.toISOString(),
                reason: event.reason,
                reassignmentId: event.reassignmentId,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.reassignment.approved")
    async handleReassignmentApproved(event: CampaignReassignmentApprovedEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `reassignment-transferred-${event.reassignmentId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_OWNERSHIP_TRANSFERRED,
            userId: event.previousFundraiserId,
            actorId: event.newFundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                newOrganizationName: event.newOrganizationName,
                newFundraiserId: event.newFundraiserId,
                reassignmentId: event.reassignmentId,
            },
            timestamp: new Date().toISOString(),
        })

        await this.notificationQueue.addNotificationJob({
            eventId: `reassignment-accepted-${event.reassignmentId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_OWNERSHIP_RECEIVED,
            userId: event.newFundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                organizationName: event.newOrganizationName,
                reassignmentId: event.reassignmentId,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.reassignment.expired")
    async handleReassignmentExpired(event: CampaignReassignmentExpiredEvent) {
        await this.notificationQueue.addNotificationJob({
            eventId: `reassignment-expired-${event.campaignId}`,
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_REASSIGNMENT_EXPIRED,
            userId: event.originalFundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                totalRefunds: event.totalRefunds,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.reassignment.accepted.admin")
    async handleReassignmentAcceptedAdmin(
        event: CampaignReassignmentAcceptedAdminEvent,
    ) {
        const adminCognitoIds = await this.getAdminCognitoIds()

        if (adminCognitoIds.length === 0) {
            return
        }

        await this.notificationQueue.addGroupedNotificationJob({
            eventIds: [`reassignment-accepted-admin-${event.reassignmentId}`],
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_REASSIGNMENT_ACCEPTED_ADMIN,
            userIds: adminCognitoIds,
            actorId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                reassignmentId: event.reassignmentId,
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                organizationName: event.organizationName,
                fundraiserName: event.fundraiserName,
                acceptedAt: new Date().toISOString(),
                note: event.note,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.reassignment.rejected.admin")
    async handleReassignmentRejectedAdmin(
        event: CampaignReassignmentRejectedAdminEvent,
    ) {
        const adminCognitoIds = await this.getAdminCognitoIds()

        if (adminCognitoIds.length === 0) {
            return
        }

        await this.notificationQueue.addGroupedNotificationJob({
            eventIds: [`reassignment-rejected-admin-${event.reassignmentId}`],
            priority: NotificationPriority.HIGH,
            type: NotificationType.CAMPAIGN_REASSIGNMENT_REJECTED_ADMIN,
            userIds: adminCognitoIds,
            actorId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                reassignmentId: event.reassignmentId,
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                organizationName: event.organizationName,
                fundraiserName: event.fundraiserName,
                rejectedAt: new Date().toISOString(),
                note: event.note,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.extended")
    async handleCampaignExtended(event: CampaignExtendedEvent) {
        await this.notificationQueue.addGroupedNotificationJob({
            eventIds: [`campaign-extended-${event.campaignId}`],
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.CAMPAIGN_EXTENDED,
            userIds: event.followerIds,
            actorId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                extensionDays: event.extensionDays,
                newEndDate: event.newEndDate,
                oldEndDate: event.oldEndDate,
            },
            timestamp: new Date().toISOString(),
        })
    }

    @OnEvent("campaign.phase.status.updated")
    async handlePhaseStatusUpdated(event: CampaignPhaseStatusUpdatedEvent) {
        await this.notificationQueue.addGroupedNotificationJob({
            eventIds: [`phase-status-updated-${event.phaseId}-${Date.now()}`],
            priority: NotificationPriority.MEDIUM,
            type: NotificationType.CAMPAIGN_PHASE_STATUS_UPDATED,
            userIds: event.followerIds,
            actorId: event.fundraiserId,
            entityType: EntityType.CAMPAIGN,
            entityId: event.campaignId,
            data: {
                campaignId: event.campaignId,
                campaignTitle: event.campaignTitle,
                phaseId: event.phaseId,
                phaseName: event.phaseName,
                oldStatus: event.oldStatus,
                newStatus: event.newStatus,
            },
            timestamp: new Date().toISOString(),
        })
    }

    private async getAdminCognitoIds(): Promise<string[]> {
        return this.userClientService.getAdminCognitoIds()
    }
}
