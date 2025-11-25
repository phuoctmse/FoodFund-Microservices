import { Injectable } from "@nestjs/common"
import { OperationExpenseType, OperationRequestStatus } from "../../domain"
import { PrismaClient } from "../../generated/operation-client"
import { OperationRequestFilterInput } from "../dtos"

export interface CreateOperationRequestData {
    campaignPhaseId: string
    userId: string
    organizationId: string
    title: string
    totalCost: bigint
    expenseType: OperationExpenseType
}

export interface UpdateStatusData {
    status: OperationRequestStatus
    adminNote?: string
    changedStatusAt: Date
}

@Injectable()
export class OperationRequestRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: CreateOperationRequestData) {
        return await this.prisma.operation_Request.create({
            data: {
                campaign_phase_id: data.campaignPhaseId,
                user_id: data.userId,
                title: data.title,
                total_cost: data.totalCost,
                expense_type: data.expenseType,
                status: OperationRequestStatus.PENDING,
            },
        })
    }

    async findById(id: string) {
        return await this.prisma.operation_Request.findUnique({
            where: { id },
        })
    }

    async findMany(filter: OperationRequestFilterInput) {
        const where: any = {}

        if (filter.campaignPhaseId) {
            where.campaign_phase_id = filter.campaignPhaseId
        }

        if (filter.status) {
            where.status = filter.status
        }

        if (filter.expenseType) {
            where.expense_type = filter.expenseType
        }

        return await this.prisma.operation_Request.findMany({
            where,
            take: filter.limit || 10,
            skip: filter.offset || 0,
            orderBy: { created_at: "desc" },
        })
    }

    async findByUserId(userId: string, limit = 10, offset = 0) {
        return await this.prisma.operation_Request.findMany({
            where: { user_id: userId },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
        })
    }

    async hasActiveRequest(
        userId: string,
        campaignPhaseId: string,
        expenseType: OperationExpenseType,
    ): Promise<boolean> {
        const count = await this.prisma.operation_Request.count({
            where: {
                user_id: userId,
                campaign_phase_id: campaignPhaseId,
                expense_type: expenseType,
                status: {
                    in: [
                        OperationRequestStatus.PENDING,
                        OperationRequestStatus.APPROVED,
                    ],
                },
            },
        })

        return count > 0
    }

    async updateStatus(id: string, data: UpdateStatusData) {
        return await this.prisma.operation_Request.update({
            where: { id },
            data: {
                status: data.status,
                admin_note: data.adminNote,
                changed_status_at: data.changedStatusAt,
            },
        })
    }

    async countByCampaignPhaseId(campaignPhaseId: string) {
        return await this.prisma.operation_Request.count({
            where: { campaign_phase_id: campaignPhaseId },
        })
    }

    async getStats() {
        const [total, pending, approved, rejected] = await Promise.all([
            this.prisma.operation_Request.count(),
            this.prisma.operation_Request.count({
                where: { status: OperationRequestStatus.PENDING },
            }),
            this.prisma.operation_Request.count({
                where: { status: OperationRequestStatus.APPROVED },
            }),
            this.prisma.operation_Request.count({
                where: { status: OperationRequestStatus.REJECTED },
            }),
        ])

        return {
            totalRequests: total,
            pendingCount: pending,
            approvedCount: approved,
            rejectedCount: rejected,
        }
    }

    async findByPhaseIds(phaseIds: string[], limit = 10, offset = 0) {
        return await this.prisma.operation_Request.findMany({
            where: {
                campaign_phase_id: {
                    in: phaseIds,
                },
            },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
        })
    }
}
