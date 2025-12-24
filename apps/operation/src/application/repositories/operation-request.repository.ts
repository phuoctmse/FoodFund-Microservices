import { Injectable } from "@nestjs/common"
import { OperationExpenseType, OperationRequestStatus } from "../../domain"
import { PrismaClient } from "../../generated/operation-client"
import { OperationRequestFilterInput } from "../dtos"
import { OperationRequestSortOrder } from "../../domain/enums/operation-request"

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
                organization_id: data.organizationId,
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

        const orderBy = this.buildOrderByClause(
            filter.sortBy || OperationRequestSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.operation_Request.findMany({
            where,
            take: filter.limit || 10,
            skip: filter.offset || 0,
            orderBy,
        })
    }

    async findByUserId(
        userId: string,
        limit = 10,
        offset = 0,
        sortBy?: OperationRequestSortOrder,
    ) {
        const orderBy = this.buildOrderByClause(
            sortBy || OperationRequestSortOrder.NEWEST_FIRST,
        )
        return await this.prisma.operation_Request.findMany({
            where: { user_id: userId },
            take: limit,
            skip: offset,
            orderBy,
        })
    }

    async findByPhaseIds(
        phaseIds: string[],
        filter: OperationRequestFilterInput,
    ) {
        const where: any = {
            campaign_phase_id: {
                in: phaseIds,
            },
        }

        if (filter.status) {
            where.status = filter.status
        }

        if (filter.expenseType) {
            where.expense_type = filter.expenseType
        }

        const orderBy = this.buildOrderByClause(
            filter.sortBy || OperationRequestSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.operation_Request.findMany({
            where,
            take: filter.limit || 10,
            skip: filter.offset || 0,
            orderBy,
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
                        OperationRequestStatus.DISBURSED,
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
        const [total, pending, approved, rejected, disbursed] = await Promise.all([
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
            this.prisma.operation_Request.count({
                where: { status: OperationRequestStatus.DISBURSED },
            }),
        ])

        return {
            totalRequests: total,
            pendingCount: pending,
            approvedCount: approved,
            rejectedCount: rejected,
            disbursedCount: disbursed,
        }
    }

    private buildOrderByClause(sortBy: OperationRequestSortOrder): {
        created_at: "asc" | "desc"
    } {
        switch (sortBy) {
        case OperationRequestSortOrder.OLDEST_FIRST:
            return { created_at: "asc" }
        case OperationRequestSortOrder.NEWEST_FIRST:
        default:
            return { created_at: "desc" }
        }
    }
}
