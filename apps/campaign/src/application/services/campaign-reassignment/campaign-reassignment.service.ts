import { CampaignReassignment } from "@app/campaign/src/domain/entities/campaign-reassignment.model"
import { CampaignStatus } from "@app/campaign/src/domain/enums/campaign/campaign.enum"
import { Role, UserClientService, UserContext } from "@app/campaign/src/shared"
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import {
    AssignCampaignToOrganizationsInput,
    RespondReassignmentInput,
} from "../../dtos/campaign-reassignment/request"
import { CampaignReassignmentStatus } from "@app/campaign/src/domain/enums/campaign/campaign-reassignment-status.enum"
import { CampaignReassignmentRepository } from "../../repositories/campaign-reassignment.repository"
import { CampaignRepository } from "../../repositories/campaign.repository"
import { SentryService } from "@libs/observability"
import { EventEmitter2 } from "@nestjs/event-emitter"
import {
    AssignCampaignResponse,
    EligibleOrganization,
    EligibleOrganizationsResponse,
} from "../../dtos/campaign-reassignment/response"
import {
    CampaignReassignmentApprovedEvent,
    CampaignReassignmentAssignedEvent,
    CampaignReassignmentExpiredEvent,
} from "@app/campaign/src/domain/events/campaign-reassignment.event"

@Injectable()
export class CampaignReassignmentService {
    private readonly REASSIGNMENT_EXPIRY_DAYS = 7

    constructor(
        private readonly reassignmentRepository: CampaignReassignmentRepository,
        private readonly campaignRepository: CampaignRepository,
        private readonly userClientService: UserClientService,
        private readonly sentryService: SentryService,
        private readonly eventEmitter: EventEmitter2,
    ) {}
    async getEligibleOrganizations(
        campaignId: string,
        userContext: UserContext,
    ): Promise<EligibleOrganizationsResponse> {
        if (userContext.role !== Role.ADMIN) {
            throw new ForbiddenException(
                "Only administrators can query eligible organizations",
            )
        }

        const campaign = await this.campaignRepository.findById(campaignId)
        if (!campaign) {
            throw new NotFoundException(`Campaign ${campaignId} not found`)
        }

        if (campaign.status !== CampaignStatus.CANCELLED) {
            throw new BadRequestException(
                `Campaign must be in CANCELLED status to reassign. Current: ${campaign.status}`,
            )
        }

        try {
            const orgsResponse =
                await this.userClientService.getVerifiedOrganizations()

            if (!orgsResponse.success || !orgsResponse.organizations) {
                return {
                    success: false,
                    message: "Failed to fetch organizations",
                    organizations: [],
                    total: 0,
                }
            }

            const eligibleOrgs: EligibleOrganization[] = []

            for (const org of orgsResponse.organizations) {
                const hasActiveCampaign =
                    await this.reassignmentRepository.hasActiveCampaign(org.id)

                const isOriginalOrg = org.id === campaign.organizationId

                if (!hasActiveCampaign && !isOriginalOrg) {
                    eligibleOrgs.push({
                        id: org.id,
                        name: org.name,
                        representativeName: org.representativeName,
                        activityField: org.activityField,
                        address: org.address,
                        phoneNumber: org.phoneNumber,
                        email: org.email,
                    })
                }
            }

            return {
                success: true,
                message: `Found ${eligibleOrgs.length} eligible organization(s)`,
                organizations: eligibleOrgs,
                total: eligibleOrgs.length,
            }
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                operation: "getEligibleOrganizations",
            })

            return {
                success: false,
                message: "Error fetching eligible organizations",
                organizations: [],
                total: 0,
            }
        }
    }

    async assignCampaignToOrganizations(
        input: AssignCampaignToOrganizationsInput,
        userContext: UserContext,
    ): Promise<AssignCampaignResponse> {
        if (userContext.role !== Role.ADMIN) {
            throw new ForbiddenException(
                "Only administrators can assign campaigns",
            )
        }

        const { campaignId, organizationIds, reason } = input

        const campaign = await this.campaignRepository.findById(campaignId)
        if (!campaign) {
            throw new NotFoundException(`Campaign ${campaignId} not found`)
        }

        if (campaign.status !== CampaignStatus.CANCELLED) {
            throw new BadRequestException(
                `Campaign must be in CANCELLED status. Current: ${campaign.status}`,
            )
        }

        const hasApproved =
            await this.reassignmentRepository.hasApprovedReassignment(
                campaignId,
            )
        if (hasApproved) {
            throw new BadRequestException(
                "Campaign already has an approved reassignment",
            )
        }

        const eligibleResponse = await this.getEligibleOrganizations(
            campaignId,
            userContext,
        )
        const eligibleIds = new Set(
            eligibleResponse.organizations.map((o) => o.id),
        )

        const invalidOrgs = organizationIds.filter((id) => !eligibleIds.has(id))
        if (invalidOrgs.length > 0) {
            throw new BadRequestException(
                `Organizations not eligible: ${invalidOrgs.join(", ")}`,
            )
        }

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + this.REASSIGNMENT_EXPIRY_DAYS)

        const assignmentData = organizationIds.map((orgId) => ({
            campaignId,
            organizationId: orgId,
            assignedBy: userContext.userId,
            expiresAt,
        }))

        const assignments =
            await this.reassignmentRepository.createMany(assignmentData)

        for (const assignment of assignments) {
            const orgInfo = await this.userClientService.getOrganizationById(
                assignment.organizationId,
            )

            if (orgInfo.success && orgInfo.organization) {
                this.eventEmitter.emit("campaign.reassignment.assigned", {
                    reassignmentId: assignment.id,
                    campaignId: campaign.id,
                    campaignTitle: campaign.title,
                    organizationId: assignment.organizationId,
                    organizationName: orgInfo.organization.name,
                    fundraiserId: orgInfo.organization.representativeId,
                    assignedBy: userContext.userId,
                    expiresAt,
                    reason,
                } satisfies CampaignReassignmentAssignedEvent)
            }
        }

        return {
            success: true,
            message: `Campaign assigned to ${assignments.length} organization(s)`,
            assignments,
            assignedCount: assignments.length,
            expiresAt,
        }
    }

    async getPendingReassignmentsForFundraiser(
        userContext: UserContext,
    ): Promise<CampaignReassignment[]> {
        if (userContext.role !== Role.FUNDRAISER) {
            throw new ForbiddenException(
                "Only fundraisers can view reassignment requests",
            )
        }

        const userInfo = await this.userClientService.getUserBasicInfo(
            userContext.userId,
        )

        if (!userInfo.success || !userInfo.user?.organizationId) {
            throw new BadRequestException(
                "You must be part of an organization to view reassignment requests",
            )
        }

        const organizationId = userInfo.user.organizationId

        return this.reassignmentRepository.findPendingByOrganizationId(
            organizationId,
        )
    }

    async respondToReassignment(
        input: RespondReassignmentInput,
        userContext: UserContext,
    ): Promise<CampaignReassignment> {
        if (userContext.role !== Role.FUNDRAISER) {
            throw new ForbiddenException(
                "Only fundraisers can respond to reassignment requests",
            )
        }

        const { reassignmentId, accept, note } = input

        const reassignment =
            await this.reassignmentRepository.findById(reassignmentId)

        if (!reassignment) {
            throw new NotFoundException(
                `Reassignment request ${reassignmentId} not found`,
            )
        }

        if (reassignment.status !== CampaignReassignmentStatus.PENDING) {
            throw new BadRequestException(
                `Reassignment is no longer pending. Status: ${reassignment.status}`,
            )
        }

        if (new Date() > reassignment.expiresAt) {
            throw new BadRequestException("Reassignment request has expired")
        }

        const userInfo = await this.userClientService.getUserBasicInfo(
            userContext.userId,
        )

        if (
            !userInfo.success ||
            userInfo.user?.organizationId !== reassignment.organizationId
        ) {
            throw new ForbiddenException(
                "You can only respond to reassignments for your organization",
            )
        }

        const hasApproved =
            await this.reassignmentRepository.hasApprovedReassignment(
                reassignment.campaignId,
            )

        if (hasApproved) {
            throw new BadRequestException(
                "This campaign has already been accepted by another organization",
            )
        }

        if (accept) {
            return this.acceptReassignment(reassignment, userContext, note)
        } else {
            return this.rejectReassignment(reassignment, note)
        }
    }

    private async acceptReassignment(
        reassignment: CampaignReassignment,
        userContext: UserContext,
        note?: string,
    ): Promise<CampaignReassignment> {
        const campaign = await this.campaignRepository.findById(
            reassignment.campaignId,
        )

        if (!campaign) {
            throw new NotFoundException(
                `Campaign ${reassignment.campaignId} not found`,
            )
        }

        const orgInfo = await this.userClientService.getOrganizationById(
            reassignment.organizationId,
        )

        if (!orgInfo.success || !orgInfo.organization) {
            throw new BadRequestException(
                "Failed to fetch organization information",
            )
        }

        const previousStatus =
            (campaign as any).previousStatus || CampaignStatus.ACTIVE

        const updatedReassignment =
            await this.reassignmentRepository.acceptReassignment({
                reassignmentId: reassignment.id,
                campaignId: campaign.id,
                previousStatus,
                newCreatedBy: userContext.userId,
                newOrganizationId: reassignment.organizationId,
                note,
            })

        this.eventEmitter.emit("campaign.reassignment.approved", {
            reassignmentId: reassignment.id,
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            newOrganizationId: reassignment.organizationId,
            newOrganizationName: orgInfo.organization.name,
            newFundraiserId: userContext.userId,
            previousOrganizationId: campaign.organizationId,
            previousFundraiserId: campaign.createdBy,
            acceptedBy: userContext.userId,
        } satisfies CampaignReassignmentApprovedEvent)

        return updatedReassignment
    }

    private async rejectReassignment(
        reassignment: CampaignReassignment,
        note?: string,
    ): Promise<CampaignReassignment> {
        const updated = await this.reassignmentRepository.updateStatus(
            reassignment.id,
            CampaignReassignmentStatus.REJECTED,
            note,
        )

        return updated
    }

    async processExpiredReassignments(): Promise<{
        expiredCount: number
        refundedCampaigns: string[]
    }> {
        const expiredAssignments =
            await this.reassignmentRepository.findExpiredPendingAssignments()

        for (const assignment of expiredAssignments) {
            await this.reassignmentRepository.updateStatus(
                assignment.id,
                CampaignReassignmentStatus.EXPIRED,
            )
        }

        const campaignsToRefund =
            await this.reassignmentRepository.findCampaignsWithExpiredAssignments()

        const refundedCampaigns: string[] = []

        for (const campaignId of campaignsToRefund) {
            try {
                await this.processRefundForCampaign(campaignId)
                refundedCampaigns.push(campaignId)
            } catch (error) {
                this.sentryService.captureError(error as Error, {
                    operation: "processRefundForCampaign",
                    campaignId,
                })
            }
        }

        return {
            expiredCount: expiredAssignments.length,
            refundedCampaigns,
        }
    }

    private async processRefundForCampaign(campaignId: string): Promise<void> {
        const campaign = await this.campaignRepository.findById(campaignId)
        if (!campaign) {
            throw new NotFoundException(`Campaign ${campaignId} not found`)
        }

        const donations =
            await this.reassignmentRepository.findDonationsForRefund(campaignId)

        for (const donation of donations) {
            for (const transaction of donation.paymentTransactions) {
                this.eventEmitter.emit("donation.refund.requested", {
                    donationId: donation.id,
                    transactionId: transaction.id,
                    campaignId,
                    donorId: donation.donorId,
                    amount: transaction.amount.toString(),
                    reason: "Campaign cancelled - no organization accepted reassignment",
                })
            }
        }

        this.eventEmitter.emit("campaign.reassignment.expired", {
            campaignId,
            campaignTitle: campaign.title,
            totalRefunds: donations.length,
            originalOrganizationId: campaign.organizationId,
            originalFundraiserId: campaign.createdBy,
        } satisfies CampaignReassignmentExpiredEvent)
    }
}
