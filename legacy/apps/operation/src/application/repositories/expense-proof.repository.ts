import { Injectable } from "@nestjs/common"
import { Prisma, PrismaClient } from "../../generated/operation-client"
import { ExpenseProofFilterInput } from "../dtos/expense-proof"
import { ExpenseProofStatus } from "../../domain/enums"
import { ExpenseProofSortOrder } from "../../domain/enums/expense-proof"

@Injectable()
export class ExpenseProofRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(data: { requestId: string; media: string[]; amount: bigint }) {
        return await this.prisma.expense_Proof.create({
            data: {
                request_id: data.requestId,
                media: data.media,
                amount: data.amount,
                status: "PENDING",
            },
        })
    }

    async findById(id: string) {
        return await this.prisma.expense_Proof.findUnique({
            where: { id },
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
        })
    }

    async findByRequestId(requestId: string, sortBy?: ExpenseProofSortOrder) {
        const orderBy = this.buildOrderByClause(
            sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.expense_Proof.findMany({
            where: { request_id: requestId },
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy,
        })
    }

    async findByOrganizationRequests(
        requestIds: string[],
        sortBy?: ExpenseProofSortOrder,
    ) {
        if (requestIds.length === 0) {
            return []
        }

        const orderBy = this.buildOrderByClause(
            sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.expense_Proof.findMany({
            where: {
                request_id: {
                    in: requestIds,
                },
            },
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy,
        })
    }

    async findLatestByRequestId(requestId: string) {
        return await this.prisma.expense_Proof.findFirst({
            where: { request_id: requestId },
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy: { created_at: "desc" },
        })
    }

    async findWithFilters(
        filter: ExpenseProofFilterInput,
        limit: number,
        offset: number,
    ) {
        const where: any = {}

        if (filter.status) {
            where.status = filter.status
        }

        if (filter.requestId) {
            where.request_id = filter.requestId
        }

        if (filter.campaignPhaseId || filter.campaignId) {
            where.request = {}

            if (filter.campaignPhaseId) {
                where.request.campaign_phase_id = filter.campaignPhaseId
            }
        }

        const orderBy = this.buildOrderByClause(
            filter.sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.expense_Proof.findMany({
            where,
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy,
            take: limit,
            skip: offset,
        })
    }

    async findByMultipleCampaignPhases(
        phaseIds: string[],
        status?: ExpenseProofStatus,
        limit: number = 10,
        offset: number = 0,
        sortBy?: ExpenseProofSortOrder,
    ) {
        if (phaseIds.length === 0) {
            return []
        }

        const where: any = {
            request: {
                campaign_phase_id: {
                    in: phaseIds,
                },
            },
        }

        if (status) {
            where.status = status
        }

        const orderBy = this.buildOrderByClause(
            sortBy || ExpenseProofSortOrder.NEWEST_FIRST,
        )

        return await this.prisma.expense_Proof.findMany({
            where,
            include: {
                request: {
                    include: {
                        items: true,
                    },
                },
            },
            orderBy,
            take: limit,
            skip: offset,
        })
    }

    async updateStatus(
        id: string,
        status: ExpenseProofStatus,
        adminNote?: string,
    ) {
        return await this.prisma.expense_Proof.update({
            where: { id },
            data: {
                status,
                admin_note: adminNote,
                changed_status_at: new Date(),
            },
        })
    }

    async getStats() {
        const [total, pending, approved, rejected] = await Promise.all([
            this.prisma.expense_Proof.count(),
            this.prisma.expense_Proof.count({
                where: { status: "PENDING" },
            }),
            this.prisma.expense_Proof.count({
                where: { status: "APPROVED" },
            }),
            this.prisma.expense_Proof.count({
                where: { status: "REJECTED" },
            }),
        ])

        return {
            totalProofs: total,
            pendingCount: pending,
            approvedCount: approved,
            rejectedCount: rejected,
        }
    }

    private buildOrderByClause(
        sortBy: ExpenseProofSortOrder,
    ):
        | Prisma.Expense_ProofOrderByWithRelationInput
        | Prisma.Expense_ProofOrderByWithRelationInput[] {
        switch (sortBy) {
        case ExpenseProofSortOrder.OLDEST_FIRST:
            return { created_at: "asc" }

        case ExpenseProofSortOrder.STATUS_PENDING_FIRST:
            return { created_at: "desc" }

        case ExpenseProofSortOrder.NEWEST_FIRST:
        default:
            return { created_at: "desc" }
        }
    }
}
