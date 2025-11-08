import { Injectable } from "@nestjs/common"
import { PrismaClient } from "../../generated/operation-client"
import { SentryService } from "@libs/observability"
import { ExpenseProofFilterInput } from "../dtos/expense-proof"
import { ExpenseProofStatus } from "../../domain/enums"

@Injectable()
export class ExpenseProofRepository {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly sentryService: SentryService,
    ) {}

    async create(data: { requestId: string; media: string[]; amount: bigint }) {
        try {
            return await this.prisma.expense_Proof.create({
                data: {
                    request_id: data.requestId,
                    media: data.media,
                    amount: data.amount,
                    status: "PENDING",
                },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.create",
                requestId: data.requestId,
            })
            throw error
        }
    }

    async findById(id: string) {
        try {
            return await this.prisma.expense_Proof.findUnique({
                where: { id },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.findById",
                proofId: id,
            })
            throw error
        }
    }

    async findByRequestId(requestId: string) {
        try {
            return await this.prisma.expense_Proof.findMany({
                where: { request_id: requestId },
                orderBy: { created_at: "desc" },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.findByRequestId",
                requestId,
            })
            throw error
        }
    }

    async findLatestByRequestId(requestId: string) {
        try {
            return await this.prisma.expense_Proof.findFirst({
                where: { request_id: requestId },
                orderBy: { created_at: "desc" },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.findLatestByRequestId",
                requestId,
            })
            throw error
        }
    }

    async findWithFilters(
        filter: ExpenseProofFilterInput,
        limit: number,
        offset: number,
    ) {
        try {
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

            return await this.prisma.expense_Proof.findMany({
                where,
                include: {
                    request: true,
                },
                orderBy: { created_at: "desc" },
                take: limit,
                skip: offset,
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.findWithFilters",
                filter,
            })
            throw error
        }
    }

    async updateStatus(
        id: string,
        status: ExpenseProofStatus,
        adminNote?: string,
    ) {
        try {
            return await this.prisma.expense_Proof.update({
                where: { id },
                data: {
                    status,
                    admin_note: adminNote,
                    changed_status_at: new Date(),
                },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.updateStatus",
                proofId: id,
                status,
            })
            throw error
        }
    }

    async getStats() {
        try {
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
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.getStats",
            })
            throw error
        }
    }

    async findByOrganizationRequests(requestIds: string[]) {
        try {
            if (requestIds.length === 0) {
                return []
            }

            return await this.prisma.expense_Proof.findMany({
                where: {
                    request_id: {
                        in: requestIds,
                    },
                },
                include: {
                    request: true,
                },
                orderBy: { created_at: "desc" },
            })
        } catch (error) {
            this.sentryService.captureError(error as Error, {
                context: "ExpenseProofRepository.findByOrganizationRequests",
                requestIdsCount: requestIds.length,
            })
            throw error
        }
    }
}
