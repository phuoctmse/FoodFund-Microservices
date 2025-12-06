import { Injectable } from "@nestjs/common"
import { CampaignReassignment } from "../../domain/entities/campaign-reassignment.model"
import { CampaignReassignmentStatus } from "../../domain/enums/campaign/campaign-reassignment-status.enum"
import { PrismaClient } from "../../generated/campaign-client"
import { CampaignStatus } from "../../domain/enums/campaign/campaign.enum"

export interface CreateReassignmentData {
    campaignId: string
    organizationId: string
    expiresAt: Date
}

export interface ReassignmentFilterInput {
    campaignId?: string
    organizationId?: string
    status?: CampaignReassignmentStatus[]
}

@Injectable()
export class CampaignReassignmentRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createMany(
        dataList: CreateReassignmentData[],
    ): Promise<CampaignReassignment[]> {
        const results = await this.prisma.$transaction(
            dataList.map((data) =>
                this.prisma.campaign_Reassignment.create({
                    data: {
                        campaign_id: data.campaignId,
                        organization_id: data.organizationId,
                        expires_at: data.expiresAt,
                        status: "PENDING",
                    },
                    include: {
                        campaign: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                }),
            ),
        )

        return results.map((r) => this.mapToModel(r))
    }

    async findById(id: string): Promise<CampaignReassignment | null> {
        const reassignment = await this.prisma.campaign_Reassignment.findUnique(
            {
                where: { id },
                include: {
                    campaign: {
                        select: {
                            id: true,
                            title: true,
                            previous_status: true,
                        },
                    },
                },
            },
        )

        return reassignment ? this.mapToModel(reassignment) : null
    }

    async findPendingByOrganizationId(
        organizationId: string,
    ): Promise<CampaignReassignment[]> {
        const reassignments = await this.prisma.campaign_Reassignment.findMany({
            where: {
                organization_id: organizationId,
                status: "PENDING",
                expires_at: { gt: new Date() },
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        cover_image: true,
                        target_amount: true,
                        received_amount: true,
                        previous_status: true,
                        created_by: true,
                        organization_id: true,
                    },
                },
            },
            orderBy: { assigned_at: "desc" },
        })

        return reassignments.map((r) => this.mapToModel(r))
    }

    async findExpiredPendingAssignments(): Promise<CampaignReassignment[]> {
        const now = new Date()

        const reassignments = await this.prisma.campaign_Reassignment.findMany({
            where: {
                status: "PENDING",
                expires_at: { lte: now },
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        })

        return reassignments.map((r) => this.mapToModel(r))
    }

    async findCampaignsWithExpiredAssignments(): Promise<string[]> {
        const now = new Date()

        const campaigns = await this.prisma.campaign.findMany({
            where: {
                status: "CANCELLED",
                reassignments: {
                    every: {
                        OR: [
                            { status: "EXPIRED" },
                            { status: "REJECTED" },
                            {
                                status: "PENDING",
                                expires_at: { lte: now },
                            },
                        ],
                    },
                    some: {}, // Ensure at least one reassignment exists
                },
            },
            select: {
                id: true,
            },
        })

        return campaigns.map((c) => c.id)
    }

    async updateStatus(
        id: string,
        status: CampaignReassignmentStatus,
        responseNote?: string,
    ): Promise<CampaignReassignment> {
        const reassignment = await this.prisma.campaign_Reassignment.update({
            where: { id },
            data: {
                status,
                responded_at: new Date(),
                response_note: responseNote,
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        })

        return this.mapToModel(reassignment)
    }

    async hasApprovedReassignment(campaignId: string): Promise<boolean> {
        const count = await this.prisma.campaign_Reassignment.count({
            where: {
                campaign_id: campaignId,
                status: "APPROVED",
            },
        })

        return count > 0
    }

    async hasActiveCampaign(organizationId: string): Promise<boolean> {
        const activeStatuses = [
            CampaignStatus.PENDING,
            CampaignStatus.APPROVED,
            CampaignStatus.ACTIVE,
            CampaignStatus.PROCESSING,
        ]

        const count = await this.prisma.campaign.count({
            where: {
                organization_id: organizationId,
                is_active: true,
                status: { in: activeStatuses },
            },
        })

        return count > 0
    }

    async findDonationsForRefund(campaignId: string): Promise<
        Array<{
            id: string
            donorId: string | null
            paymentTransactions: Array<{
                id: string
                amount: bigint
            }>
        }>
    > {
        const donations = await this.prisma.donation.findMany({
            where: {
                campaign_id: campaignId,
            },
            select: {
                id: true,
                donor_id: true,
                payment_transactions: {
                    where: {
                        status: "SUCCESS",
                    },
                    select: {
                        id: true,
                        amount: true,
                    },
                },
            },
        })

        return donations.map((d) => ({
            id: d.id,
            donorId: d.donor_id,
            paymentTransactions: d.payment_transactions.map((t) => ({
                id: t.id,
                amount: t.amount,
            })),
        }))
    }

    async acceptReassignment(data: {
        reassignmentId: string
        campaignId: string
        previousStatus: CampaignStatus
        newCreatedBy: string
        newOrganizationId: string
        note?: string
    }): Promise<CampaignReassignment> {
        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Restore campaign to previous status and update ownership
            await tx.campaign.update({
                where: { id: data.campaignId },
                data: {
                    status: data.previousStatus,
                    created_by: data.newCreatedBy,
                    organization_id: data.newOrganizationId,
                    previous_status: null,
                    reason: null,
                },
            })

            // 2. Update reassignment status to APPROVED
            const updatedReassignment = await tx.campaign_Reassignment.update({
                where: { id: data.reassignmentId },
                data: {
                    status: "APPROVED",
                    responded_at: new Date(),
                    response_note: data.note,
                },
                include: {
                    campaign: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                },
            })

            // 3. Reject all other pending reassignments for this campaign
            await tx.campaign_Reassignment.updateMany({
                where: {
                    campaign_id: data.campaignId,
                    status: "PENDING",
                    id: { not: data.reassignmentId },
                },
                data: {
                    status: "REJECTED",
                    responded_at: new Date(),
                    response_note:
                        "Auto-rejected: Another organization accepted",
                },
            })

            return updatedReassignment
        })

        return this.mapToModel(result)
    }

    private mapToModel(data: any): CampaignReassignment {
        return {
            id: data.id,
            campaignId: data.campaign_id,
            organizationId: data.organization_id,
            status: data.status as CampaignReassignmentStatus,
            assignedAt: data.assigned_at,
            expiresAt: data.expires_at,
            respondedAt: data.responded_at || undefined,
            responseNote: data.response_note || undefined,
            created_at: data.created_at,
            updated_at: data.updated_at,
            organization: {
                __typename: "Organization",
                id: data.organization_id,
            },
            campaign: data.campaign || undefined,
        }
    }
}
